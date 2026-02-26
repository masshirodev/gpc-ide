import { TokenType, InterpreterError, type Token } from './types';

const KEYWORDS: Record<string, TokenType> = {
	int: TokenType.KwInt,
	const: TokenType.KwConst,
	for: TokenType.KwFor,
	if: TokenType.KwIf,
	else: TokenType.KwElse,
	while: TokenType.KwWhile
};

export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;
	let line = 1;
	let col = 1;

	function peek(): string {
		return pos < source.length ? source[pos] : '\0';
	}

	function peekNext(): string {
		return pos + 1 < source.length ? source[pos + 1] : '\0';
	}

	function advance(): string {
		const ch = source[pos++];
		if (ch === '\n') {
			line++;
			col = 1;
		} else {
			col++;
		}
		return ch;
	}

	function push(type: TokenType, value: string, startCol: number) {
		tokens.push({ type, value, line, col: startCol });
	}

	while (pos < source.length) {
		const ch = peek();
		const startCol = col;

		// Whitespace
		if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
			advance();
			continue;
		}

		// Single-line comment
		if (ch === '/' && peekNext() === '/') {
			while (pos < source.length && peek() !== '\n') advance();
			continue;
		}

		// Block comment
		if (ch === '/' && peekNext() === '*') {
			advance();
			advance(); // skip /*
			while (pos < source.length) {
				if (peek() === '*' && peekNext() === '/') {
					advance();
					advance();
					break;
				}
				advance();
			}
			continue;
		}

		// Numbers
		if (ch >= '0' && ch <= '9') {
			let num = '';
			if (ch === '0' && (peekNext() === 'x' || peekNext() === 'X')) {
				num += advance(); // 0
				num += advance(); // x
				while (pos < source.length && /[0-9a-fA-F]/.test(peek())) {
					num += advance();
				}
			} else {
				while (pos < source.length && peek() >= '0' && peek() <= '9') {
					num += advance();
				}
			}
			push(TokenType.Number, num, startCol);
			continue;
		}

		// Identifiers and keywords
		if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
			let ident = '';
			while (
				pos < source.length &&
				((peek() >= 'a' && peek() <= 'z') ||
					(peek() >= 'A' && peek() <= 'Z') ||
					(peek() >= '0' && peek() <= '9') ||
					peek() === '_')
			) {
				ident += advance();
			}
			const kwType = KEYWORDS[ident];
			push(kwType !== undefined ? kwType : TokenType.Identifier, ident, startCol);
			continue;
		}

		// String literals
		if (ch === '"') {
			advance(); // skip opening quote
			let str = '';
			while (pos < source.length && peek() !== '"') {
				if (peek() === '\\') {
					advance();
					const esc = advance();
					if (esc === 'n') str += '\n';
					else if (esc === 't') str += '\t';
					else if (esc === '\\') str += '\\';
					else if (esc === '"') str += '"';
					else str += esc;
				} else {
					str += advance();
				}
			}
			if (pos >= source.length) {
				throw new InterpreterError('Unterminated string literal', line, startCol);
			}
			advance(); // skip closing quote
			push(TokenType.String, str, startCol);
			continue;
		}

		// Two-character operators
		const next = peekNext();
		if (ch === '+' && next === '+') {
			advance();
			advance();
			push(TokenType.PlusPlus, '++', startCol);
			continue;
		}
		if (ch === '-' && next === '-') {
			advance();
			advance();
			push(TokenType.MinusMinus, '--', startCol);
			continue;
		}
		if (ch === '+' && next === '=') {
			advance();
			advance();
			push(TokenType.PlusAssign, '+=', startCol);
			continue;
		}
		if (ch === '-' && next === '=') {
			advance();
			advance();
			push(TokenType.MinusAssign, '-=', startCol);
			continue;
		}
		if (ch === '*' && next === '=') {
			advance();
			advance();
			push(TokenType.StarAssign, '*=', startCol);
			continue;
		}
		if (ch === '/' && next === '=') {
			advance();
			advance();
			push(TokenType.SlashAssign, '/=', startCol);
			continue;
		}
		if (ch === '%' && next === '=') {
			advance();
			advance();
			push(TokenType.PercentAssign, '%=', startCol);
			continue;
		}
		if (ch === '=' && next === '=') {
			advance();
			advance();
			push(TokenType.Eq, '==', startCol);
			continue;
		}
		if (ch === '!' && next === '=') {
			advance();
			advance();
			push(TokenType.Neq, '!=', startCol);
			continue;
		}
		if (ch === '<' && next === '=') {
			advance();
			advance();
			push(TokenType.Lte, '<=', startCol);
			continue;
		}
		if (ch === '>' && next === '=') {
			advance();
			advance();
			push(TokenType.Gte, '>=', startCol);
			continue;
		}
		if (ch === '<' && next === '<') {
			advance();
			advance();
			push(TokenType.ShiftLeft, '<<', startCol);
			continue;
		}
		if (ch === '>' && next === '>') {
			advance();
			advance();
			push(TokenType.ShiftRight, '>>', startCol);
			continue;
		}
		if (ch === '&' && next === '&') {
			advance();
			advance();
			push(TokenType.And, '&&', startCol);
			continue;
		}
		if (ch === '|' && next === '|') {
			advance();
			advance();
			push(TokenType.Or, '||', startCol);
			continue;
		}

		// Single-character operators
		const singleOps: Record<string, TokenType> = {
			'(': TokenType.LParen,
			')': TokenType.RParen,
			'{': TokenType.LBrace,
			'}': TokenType.RBrace,
			'[': TokenType.LBracket,
			']': TokenType.RBracket,
			';': TokenType.Semicolon,
			',': TokenType.Comma,
			'=': TokenType.Assign,
			'+': TokenType.Plus,
			'-': TokenType.Minus,
			'*': TokenType.Star,
			'/': TokenType.Slash,
			'%': TokenType.Percent,
			'<': TokenType.Lt,
			'>': TokenType.Gt,
			'!': TokenType.Not,
			'&': TokenType.BitAnd,
			'|': TokenType.BitOr,
			'^': TokenType.BitXor,
			'~': TokenType.BitNot
		};

		const opType = singleOps[ch];
		if (opType !== undefined) {
			advance();
			push(opType, ch, startCol);
			continue;
		}

		throw new InterpreterError(`Unexpected character: '${ch}'`, line, col);
	}

	push(TokenType.EOF, '', col);
	return tokens;
}
