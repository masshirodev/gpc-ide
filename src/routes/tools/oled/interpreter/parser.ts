import {
	TokenType,
	InterpreterError,
	type Token,
	type ProgramNode,
	type Statement,
	type Expr,
	type VarDeclNode,
	type IfNode,
	type ForNode,
	type WhileNode,
	type ExprStmtNode,
	type AssignNode,
	type BlockNode
} from './types';
import { tokenize } from './tokenizer';

export function parse(source: string): ProgramNode {
	const tokens = tokenize(source);
	let pos = 0;

	function current(): Token {
		return tokens[pos];
	}

	function at(type: TokenType): boolean {
		return current().type === type;
	}

	function expect(type: TokenType, what?: string): Token {
		const tok = current();
		if (tok.type !== type) {
			throw new InterpreterError(
				`Expected ${what || TokenType[type]}, got '${tok.value || TokenType[tok.type]}'`,
				tok.line,
				tok.col
			);
		}
		pos++;
		return tok;
	}

	function consume(type: TokenType): Token | null {
		if (at(type)) {
			const tok = current();
			pos++;
			return tok;
		}
		return null;
	}

	// --- Statements ---

	function parseProgram(): ProgramNode {
		const body: Statement[] = [];
		while (!at(TokenType.EOF)) {
			body.push(parseStatement());
		}
		return { kind: 'program', body };
	}

	function parseStatement(): Statement {
		if (at(TokenType.KwInt) || at(TokenType.KwConst)) return parseVarDecl();
		if (at(TokenType.KwIf)) return parseIf();
		if (at(TokenType.KwFor)) return parseFor();
		if (at(TokenType.KwWhile)) return parseWhile();
		if (at(TokenType.LBrace)) return parseBlock();
		return parseExprStatement();
	}

	function parseVarDecl(): VarDeclNode {
		const isConst = at(TokenType.KwConst);
		pos++; // skip int/const
		if (isConst && at(TokenType.KwInt)) pos++; // const int
		const nameTok = expect(TokenType.Identifier, 'variable name');
		let init: Expr | null = null;
		if (consume(TokenType.Assign)) {
			init = parseExpr();
		}
		expect(TokenType.Semicolon, "';'");
		return { kind: 'var_decl', name: nameTok.value, isConst, init, line: nameTok.line };
	}

	function parseIf(): IfNode {
		const tok = expect(TokenType.KwIf);
		expect(TokenType.LParen, "'('");
		const condition = parseExpr();
		expect(TokenType.RParen, "')'");
		const then = parseBlockOrStatement();
		let else_: Statement[] | null = null;
		if (consume(TokenType.KwElse)) {
			if (at(TokenType.KwIf)) {
				else_ = [parseIf()];
			} else {
				else_ = parseBlockOrStatement();
			}
		}
		return { kind: 'if', condition, then, else_, line: tok.line };
	}

	function parseFor(): ForNode {
		const tok = expect(TokenType.KwFor);
		expect(TokenType.LParen, "'('");

		// Init
		let init: Statement | null = null;
		if (at(TokenType.KwInt) || at(TokenType.KwConst)) {
			init = parseVarDecl(); // includes semicolon
		} else if (!at(TokenType.Semicolon)) {
			init = parseExprStatement(); // includes semicolon
		} else {
			pos++; // skip bare semicolon
		}

		// Condition
		let condition: Expr | null = null;
		if (!at(TokenType.Semicolon)) {
			condition = parseExpr();
		}
		expect(TokenType.Semicolon, "';'");

		// Update
		let update: Statement | null = null;
		if (!at(TokenType.RParen)) {
			const expr = parseExpr();
			update = resolveExprToStatement(expr);
		}
		expect(TokenType.RParen, "')'");

		const body = parseBlockOrStatement();
		return { kind: 'for', init, condition, update, body, line: tok.line };
	}

	function parseWhile(): WhileNode {
		const tok = expect(TokenType.KwWhile);
		expect(TokenType.LParen, "'('");
		const condition = parseExpr();
		expect(TokenType.RParen, "')'");
		const body = parseBlockOrStatement();
		return { kind: 'while', condition, body, line: tok.line };
	}

	function parseBlock(): BlockNode {
		expect(TokenType.LBrace, "'{'");
		const body: Statement[] = [];
		while (!at(TokenType.RBrace) && !at(TokenType.EOF)) {
			body.push(parseStatement());
		}
		expect(TokenType.RBrace, "'}'");
		return { kind: 'block', body };
	}

	function parseBlockOrStatement(): Statement[] {
		if (at(TokenType.LBrace)) {
			const block = parseBlock();
			return block.body;
		}
		return [parseStatement()];
	}

	function parseExprStatement(): ExprStmtNode | AssignNode {
		const expr = parseExpr();
		expect(TokenType.Semicolon, "';'");
		return resolveExprToStatement(expr);
	}

	function resolveExprToStatement(expr: Expr): ExprStmtNode | AssignNode {
		// Check if it's an assignment expression (ident = expr was parsed as binary '=')
		if (expr.kind === 'ident') {
			const assignOps: Record<number, AssignNode['op']> = {
				[TokenType.Assign]: '=',
				[TokenType.PlusAssign]: '+=',
				[TokenType.MinusAssign]: '-=',
				[TokenType.StarAssign]: '*=',
				[TokenType.SlashAssign]: '/=',
				[TokenType.PercentAssign]: '%='
			};
			const opType = current().type;
			const op = assignOps[opType];
			if (op) {
				pos++;
				const rhs = parseExpr();
				return { kind: 'assign', name: expr.name, op, expr: rhs, line: expr.line };
			}
		}
		return { kind: 'expr_stmt', expr };
	}

	// --- Expressions (precedence climbing) ---

	function parseExpr(): Expr {
		return parseLogicalOr();
	}

	function parseLogicalOr(): Expr {
		let left = parseLogicalAnd();
		while (consume(TokenType.Or)) {
			const right = parseLogicalAnd();
			left = { kind: 'binary', op: '||', left, right, line: left.line };
		}
		return left;
	}

	function parseLogicalAnd(): Expr {
		let left = parseBitwiseOr();
		while (consume(TokenType.And)) {
			const right = parseBitwiseOr();
			left = { kind: 'binary', op: '&&', left, right, line: left.line };
		}
		return left;
	}

	function parseBitwiseOr(): Expr {
		let left = parseBitwiseXor();
		while (consume(TokenType.BitOr)) {
			const right = parseBitwiseXor();
			left = { kind: 'binary', op: '|', left, right, line: left.line };
		}
		return left;
	}

	function parseBitwiseXor(): Expr {
		let left = parseBitwiseAnd();
		while (consume(TokenType.BitXor)) {
			const right = parseBitwiseAnd();
			left = { kind: 'binary', op: '^', left, right, line: left.line };
		}
		return left;
	}

	function parseBitwiseAnd(): Expr {
		let left = parseEquality();
		while (consume(TokenType.BitAnd)) {
			const right = parseEquality();
			left = { kind: 'binary', op: '&', left, right, line: left.line };
		}
		return left;
	}

	function parseEquality(): Expr {
		let left = parseComparison();
		while (at(TokenType.Eq) || at(TokenType.Neq)) {
			const op = current().value;
			pos++;
			const right = parseComparison();
			left = { kind: 'binary', op, left, right, line: left.line };
		}
		return left;
	}

	function parseComparison(): Expr {
		let left = parseShift();
		while (at(TokenType.Lt) || at(TokenType.Gt) || at(TokenType.Lte) || at(TokenType.Gte)) {
			const op = current().value;
			pos++;
			const right = parseShift();
			left = { kind: 'binary', op, left, right, line: left.line };
		}
		return left;
	}

	function parseShift(): Expr {
		let left = parseAdditive();
		while (at(TokenType.ShiftLeft) || at(TokenType.ShiftRight)) {
			const op = current().value;
			pos++;
			const right = parseAdditive();
			left = { kind: 'binary', op, left, right, line: left.line };
		}
		return left;
	}

	function parseAdditive(): Expr {
		let left = parseMultiplicative();
		while (at(TokenType.Plus) || at(TokenType.Minus)) {
			const op = current().value;
			pos++;
			const right = parseMultiplicative();
			left = { kind: 'binary', op, left, right, line: left.line };
		}
		return left;
	}

	function parseMultiplicative(): Expr {
		let left = parseUnary();
		while (at(TokenType.Star) || at(TokenType.Slash) || at(TokenType.Percent)) {
			const op = current().value;
			pos++;
			const right = parseUnary();
			left = { kind: 'binary', op, left, right, line: left.line };
		}
		return left;
	}

	function parseUnary(): Expr {
		const tok = current();
		if (at(TokenType.Minus)) {
			pos++;
			const operand = parseUnary();
			return { kind: 'unary', op: '-', operand, line: tok.line };
		}
		if (at(TokenType.Not)) {
			pos++;
			const operand = parseUnary();
			return { kind: 'unary', op: '!', operand, line: tok.line };
		}
		if (at(TokenType.BitNot)) {
			pos++;
			const operand = parseUnary();
			return { kind: 'unary', op: '~', operand, line: tok.line };
		}
		// Prefix ++ / --
		if (at(TokenType.PlusPlus) || at(TokenType.MinusMinus)) {
			const op = tok.value as '++' | '--';
			pos++;
			const name = expect(TokenType.Identifier, 'variable name');
			return { kind: 'increment', name: name.value, op, prefix: true, line: tok.line };
		}
		return parsePostfix();
	}

	function parsePostfix(): Expr {
		let expr = parsePrimary();

		while (true) {
			// Function call
			if (at(TokenType.LParen) && expr.kind === 'ident') {
				pos++;
				const args: Expr[] = [];
				if (!at(TokenType.RParen)) {
					args.push(parseExpr());
					while (consume(TokenType.Comma)) {
						args.push(parseExpr());
					}
				}
				expect(TokenType.RParen, "')'");
				expr = { kind: 'call', name: expr.name, args, line: expr.line };
				continue;
			}
			// Array access
			if (at(TokenType.LBracket) && expr.kind === 'ident') {
				pos++;
				const index = parseExpr();
				expect(TokenType.RBracket, "']'");
				expr = { kind: 'array_access', name: expr.name, index, line: expr.line };
				continue;
			}
			// Postfix ++ / --
			if (
				(at(TokenType.PlusPlus) || at(TokenType.MinusMinus)) &&
				expr.kind === 'ident'
			) {
				const op = current().value as '++' | '--';
				pos++;
				expr = { kind: 'increment', name: expr.name, op, prefix: false, line: expr.line };
				continue;
			}
			break;
		}

		return expr;
	}

	function parsePrimary(): Expr {
		const tok = current();

		if (at(TokenType.Number)) {
			pos++;
			const value = tok.value.startsWith('0x') || tok.value.startsWith('0X')
				? parseInt(tok.value, 16)
				: parseInt(tok.value, 10);
			return { kind: 'number', value, line: tok.line };
		}

		if (at(TokenType.String)) {
			pos++;
			return { kind: 'string', value: tok.value, line: tok.line };
		}

		if (at(TokenType.Identifier)) {
			pos++;
			return { kind: 'ident', name: tok.value, line: tok.line };
		}

		if (at(TokenType.LParen)) {
			pos++;
			const expr = parseExpr();
			expect(TokenType.RParen, "')'");
			return expr;
		}

		throw new InterpreterError(
			`Unexpected token: '${tok.value || TokenType[tok.type]}'`,
			tok.line,
			tok.col
		);
	}

	return parseProgram();
}
