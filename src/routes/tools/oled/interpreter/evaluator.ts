import {
	InterpreterError,
	type ProgramNode,
	type Statement,
	type Expr,
	type InterpreterResult
} from './types';
import { parse } from './parser';
import { setPixel, createEmptyPixels, clonePixels } from '../pixels';
import { drawBresenhamLine, drawRect, drawEllipse, drawText } from '../drawing';
import { getFont } from '../fonts';
import type { FontSize } from '../types';

const MAX_STEPS = 500_000;

const BUILTIN_CONSTANTS: Record<string, number> = {
	OLED_BLACK: 0,
	OLED_WHITE: 1,
	OLED_FONT_SMALL: 0,
	OLED_FONT_MEDIUM: 1,
	OLED_FONT_LARGE: 2,
	TRUE: 1,
	FALSE: 0
};

const FONT_MAP: FontSize[] = ['3x5', '5x7', '8x8'];

export function evaluate(source: string, basePixels?: Uint8Array): InterpreterResult {
	try {
		const ast = parse(source);
		const pixels = basePixels ? clonePixels(basePixels) : createEmptyPixels();
		const env = new Map<string, number>();
		const consts = new Set<string>();
		let steps = 0;

		// Populate built-in constants
		for (const [name, value] of Object.entries(BUILTIN_CONSTANTS)) {
			env.set(name, value);
			consts.add(name);
		}

		// String buffer for putc_oled / puts_oled
		const stringBuffer: number[] = new Array(256).fill(0);

		function step(line: number) {
			if (++steps > MAX_STEPS) {
				throw new InterpreterError('Execution limit exceeded (possible infinite loop)', line);
			}
		}

		function getVar(name: string, line: number): number {
			const val = env.get(name);
			if (val === undefined) {
				throw new InterpreterError(`Undefined variable: '${name}'`, line);
			}
			return val;
		}

		function setVar(name: string, value: number, line: number) {
			if (consts.has(name)) {
				throw new InterpreterError(`Cannot assign to constant: '${name}'`, line);
			}
			env.set(name, value | 0); // clamp to int32
		}

		function callBuiltin(name: string, args: number[], strArgs: (string | null)[], line: number): number {
			switch (name) {
				case 'cls_oled': {
					if (args.length < 1) throw new InterpreterError('cls_oled requires 1 argument', line);
					pixels.fill(args[0] ? 0xff : 0);
					return 0;
				}
				case 'pixel_oled': {
					if (args.length < 3) throw new InterpreterError('pixel_oled requires 3 arguments', line);
					setPixel(pixels, args[0], args[1], args[2] !== 0);
					return 0;
				}
				case 'line_oled': {
					if (args.length < 6) throw new InterpreterError('line_oled requires 6 arguments (x, y, tox, toy, thickness, color)', line);
					const thickness = Math.max(1, args[4]);
					drawBresenhamLine(
						pixels, args[0], args[1], args[2], args[3],
						args[5] !== 0,
						{ type: 'square', width: thickness, height: thickness }
					);
					return 0;
				}
				case 'rect_oled': {
					if (args.length < 6) throw new InterpreterError('rect_oled requires 6 arguments (x, y, w, h, fill, color)', line);
					const [rx, ry, rw, rh, fill, color] = args;
					drawRect(pixels, rx, ry, rx + rw - 1, ry + rh - 1, fill !== 0, color !== 0);
					return 0;
				}
				case 'circle_oled': {
					if (args.length < 5) throw new InterpreterError('circle_oled requires 5 arguments (x, y, r, fill, color)', line);
					drawEllipse(pixels, args[0], args[1], args[2], args[2], args[3] !== 0, args[4] !== 0);
					return 0;
				}
				case 'putc_oled': {
					if (args.length < 2) throw new InterpreterError('putc_oled requires 2 arguments (position, ascii)', line);
					const position = args[0];
					if (position >= 0 && position < stringBuffer.length) {
						stringBuffer[position] = args[1];
					}
					return 0;
				}
				case 'puts_oled': {
					// puts_oled(x, y, font, length, color) - draws from string buffer
					// Also support: puts_oled(x, y, font, "string", color)
					if (args.length < 4) throw new InterpreterError('puts_oled requires at least 4 arguments', line);
					const fontIdx = Math.max(0, Math.min(2, args[2]));
					const font = getFont(FONT_MAP[fontIdx]);
					const color = args.length >= 5 ? args[args.length - 1] !== 0 : true;

					// Check if 4th arg is a string
					if (strArgs[3]) {
						drawText(pixels, strArgs[3], args[0], args[1], font, color);
					} else {
						// Use string buffer, args[3] is length
						const len = args[3];
						let text = '';
						for (let i = 0; i < len; i++) {
							text += String.fromCharCode(stringBuffer[i] || 32);
						}
						drawText(pixels, text, args[0], args[1], font, color);
					}
					return 0;
				}
				case 'text_oled': {
					// text_oled(x, y, font, color, "string")
					if (args.length < 4) throw new InterpreterError('text_oled requires 5 arguments (x, y, font, color, "string")', line);
					const fontIdx = Math.max(0, Math.min(2, args[2]));
					const font = getFont(FONT_MAP[fontIdx]);
					const text = strArgs[4] || strArgs[3] || '';
					const color = args[3] !== 0;
					drawText(pixels, text, args[0], args[1], font, color);
					return 0;
				}
				case 'abs':
					if (args.length < 1) throw new InterpreterError('abs requires 1 argument', line);
					return Math.abs(args[0]);
				case 'min':
					if (args.length < 2) throw new InterpreterError('min requires 2 arguments', line);
					return Math.min(args[0], args[1]);
				case 'max':
					if (args.length < 2) throw new InterpreterError('max requires 2 arguments', line);
					return Math.max(args[0], args[1]);
				default:
					throw new InterpreterError(`Unknown function: '${name}'`, line);
			}
		}

		function evalExpr(expr: Expr): number {
			step(expr.line);
			switch (expr.kind) {
				case 'number':
					return expr.value;
				case 'string':
					return 0; // strings are only used as function arguments
				case 'ident':
					return getVar(expr.name, expr.line);
				case 'unary': {
					const val = evalExpr(expr.operand);
					switch (expr.op) {
						case '-': return (-val) | 0;
						case '!': return val === 0 ? 1 : 0;
						case '~': return ~val;
						default: return val;
					}
				}
				case 'binary': {
					// Short-circuit for logical operators
					if (expr.op === '&&') {
						return evalExpr(expr.left) !== 0 && evalExpr(expr.right) !== 0 ? 1 : 0;
					}
					if (expr.op === '||') {
						return evalExpr(expr.left) !== 0 || evalExpr(expr.right) !== 0 ? 1 : 0;
					}
					const l = evalExpr(expr.left);
					const r = evalExpr(expr.right);
					switch (expr.op) {
						case '+': return (l + r) | 0;
						case '-': return (l - r) | 0;
						case '*': return Math.imul(l, r);
						case '/':
							if (r === 0) throw new InterpreterError('Division by zero', expr.line);
							return Math.trunc(l / r);
						case '%':
							if (r === 0) throw new InterpreterError('Modulo by zero', expr.line);
							return (l % r) | 0;
						case '&': return l & r;
						case '|': return l | r;
						case '^': return l ^ r;
						case '<<': return l << r;
						case '>>': return l >> r;
						case '==': return l === r ? 1 : 0;
						case '!=': return l !== r ? 1 : 0;
						case '<': return l < r ? 1 : 0;
						case '>': return l > r ? 1 : 0;
						case '<=': return l <= r ? 1 : 0;
						case '>=': return l >= r ? 1 : 0;
						default: return 0;
					}
				}
				case 'call': {
					const numArgs: number[] = [];
					const strArgs: (string | null)[] = [];
					for (const arg of expr.args) {
						if (arg.kind === 'string') {
							numArgs.push(0);
							strArgs.push(arg.value);
						} else {
							numArgs.push(evalExpr(arg));
							strArgs.push(null);
						}
					}
					return callBuiltin(expr.name, numArgs, strArgs, expr.line);
				}
				case 'increment': {
					const val = getVar(expr.name, expr.line);
					const delta = expr.op === '++' ? 1 : -1;
					const newVal = (val + delta) | 0;
					setVar(expr.name, newVal, expr.line);
					return expr.prefix ? newVal : val;
				}
				case 'array_access':
					throw new InterpreterError('Array access is not supported', expr.line);
			}
		}

		function execStmt(stmt: Statement): void {
			step(stmt.kind === 'expr_stmt' ? (stmt.expr.line) : ('line' in stmt ? (stmt as { line: number }).line : 0));
			switch (stmt.kind) {
				case 'var_decl': {
					const value = stmt.init ? evalExpr(stmt.init) : 0;
					if (env.has(stmt.name) && consts.has(stmt.name)) {
						throw new InterpreterError(`Cannot redeclare constant: '${stmt.name}'`, stmt.line);
					}
					env.set(stmt.name, value | 0);
					if (stmt.isConst) consts.add(stmt.name);
					break;
				}
				case 'assign': {
					let value = evalExpr(stmt.expr);
					if (stmt.op !== '=') {
						const current = getVar(stmt.name, stmt.line);
						switch (stmt.op) {
							case '+=': value = (current + value) | 0; break;
							case '-=': value = (current - value) | 0; break;
							case '*=': value = Math.imul(current, value); break;
							case '/=':
								if (value === 0) throw new InterpreterError('Division by zero', stmt.line);
								value = Math.trunc(current / value);
								break;
							case '%=':
								if (value === 0) throw new InterpreterError('Modulo by zero', stmt.line);
								value = (current % value) | 0;
								break;
						}
					}
					setVar(stmt.name, value, stmt.line);
					break;
				}
				case 'expr_stmt':
					evalExpr(stmt.expr);
					break;
				case 'if': {
					const cond = evalExpr(stmt.condition);
					if (cond !== 0) {
						for (const s of stmt.then) execStmt(s);
					} else if (stmt.else_) {
						for (const s of stmt.else_) execStmt(s);
					}
					break;
				}
				case 'for': {
					if (stmt.init) execStmt(stmt.init);
					while (true) {
						step(stmt.line);
						if (stmt.condition && evalExpr(stmt.condition) === 0) break;
						for (const s of stmt.body) execStmt(s);
						if (stmt.update) execStmt(stmt.update);
					}
					break;
				}
				case 'while': {
					while (true) {
						step(stmt.line);
						if (evalExpr(stmt.condition) === 0) break;
						for (const s of stmt.body) execStmt(s);
					}
					break;
				}
				case 'block': {
					for (const s of stmt.body) execStmt(s);
					break;
				}
			}
		}

		function exec(program: ProgramNode) {
			for (const stmt of program.body) {
				execStmt(stmt);
			}
		}

		exec(ast);
		return { ok: true, pixels };
	} catch (e) {
		if (e instanceof InterpreterError) {
			return { ok: false, error: { message: e.message, line: e.line } };
		}
		return { ok: false, error: { message: String(e), line: 0 } };
	}
}
