export enum TokenType {
	Number,
	Identifier,
	String,
	LParen,
	RParen,
	LBrace,
	RBrace,
	LBracket,
	RBracket,
	Semicolon,
	Comma,
	Assign,
	Plus,
	Minus,
	Star,
	Slash,
	Percent,
	PlusAssign,
	MinusAssign,
	StarAssign,
	SlashAssign,
	PercentAssign,
	PlusPlus,
	MinusMinus,
	Eq,
	Neq,
	Lt,
	Gt,
	Lte,
	Gte,
	And,
	Or,
	Not,
	BitAnd,
	BitOr,
	BitXor,
	BitNot,
	ShiftLeft,
	ShiftRight,
	KwInt,
	KwConst,
	KwFor,
	KwIf,
	KwElse,
	KwWhile,
	EOF
}

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	col: number;
}

// --- AST Nodes ---

export interface ProgramNode {
	kind: 'program';
	body: Statement[];
}

export interface VarDeclNode {
	kind: 'var_decl';
	name: string;
	isConst: boolean;
	init: Expr | null;
	line: number;
}

export interface AssignNode {
	kind: 'assign';
	name: string;
	op: '=' | '+=' | '-=' | '*=' | '/=' | '%=';
	expr: Expr;
	line: number;
}

export interface ExprStmtNode {
	kind: 'expr_stmt';
	expr: Expr;
}

export interface IfNode {
	kind: 'if';
	condition: Expr;
	then: Statement[];
	else_: Statement[] | null;
	line: number;
}

export interface ForNode {
	kind: 'for';
	init: Statement | null;
	condition: Expr | null;
	update: Statement | null;
	body: Statement[];
	line: number;
}

export interface WhileNode {
	kind: 'while';
	condition: Expr;
	body: Statement[];
	line: number;
}

export interface BlockNode {
	kind: 'block';
	body: Statement[];
}

export type Statement =
	| VarDeclNode
	| AssignNode
	| ExprStmtNode
	| IfNode
	| ForNode
	| WhileNode
	| BlockNode;

export interface CallExpr {
	kind: 'call';
	name: string;
	args: Expr[];
	line: number;
}

export interface BinaryExpr {
	kind: 'binary';
	op: string;
	left: Expr;
	right: Expr;
	line: number;
}

export interface UnaryExpr {
	kind: 'unary';
	op: string;
	operand: Expr;
	line: number;
}

export interface NumberLiteral {
	kind: 'number';
	value: number;
	line: number;
}

export interface IdentExpr {
	kind: 'ident';
	name: string;
	line: number;
}

export interface StringLiteral {
	kind: 'string';
	value: string;
	line: number;
}

export interface ArrayAccessExpr {
	kind: 'array_access';
	name: string;
	index: Expr;
	line: number;
}

export interface IncrementExpr {
	kind: 'increment';
	name: string;
	op: '++' | '--';
	prefix: boolean;
	line: number;
}

export type Expr =
	| CallExpr
	| BinaryExpr
	| UnaryExpr
	| NumberLiteral
	| IdentExpr
	| StringLiteral
	| ArrayAccessExpr
	| IncrementExpr;

export class InterpreterError extends Error {
	line: number;
	col: number;

	constructor(message: string, line: number, col: number = 0) {
		super(message);
		this.line = line;
		this.col = col;
	}
}

export type InterpreterResult =
	| { ok: true; pixels: Uint8Array }
	| { ok: false; error: { message: string; line: number } };
