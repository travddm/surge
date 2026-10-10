/**
 * Folds the cursor of one generated function (Transformer 5.30 in
 * docs/specs/transformer.md). Each reservation the emitter writes reads the
 * cursor into a position local and moves the cursor past the bytes:
 *
 *   const pos1 = cursor; cursor = pos1 + 4; ...; const pos2 = cursor; cursor = pos2 + 1;
 *
 * This pass follows the cursor's value through each block, as an offset from
 * a position local or, where the function set it to a number, as a number.
 * A position local read from a cursor whose value it knows becomes that
 * offset, and so does one computed from such a local; a move of the cursor
 * by a constant is dropped. The cursor is assigned its value only where
 * something assigns it otherwise, or where a branch or a loop begins or ends.
 * Two adjacent reservations then move the cursor once, and the fixed bytes at
 * the head of a function are written at numbers.
 *
 * Anything it does not recognize, it leaves as it is: a statement that
 * assigns the cursor in another form ends what it knows. It runs only where
 * every read and assignment of the cursor is in the function's own text,
 * which a recursion helper's reads of the closure's cursor are not.
 */
import type ts from "typescript";

import type { EmitContext } from "./context";

/** A cursor value: `offset` past the position local `base`, or the number `offset` with no base. */
interface Offset {
	readonly base: ts.Identifier | undefined;
	readonly offset: number;
}

/** What a block knows of the cursor at the statement being folded. */
interface State {
	/** The cursor's value, or `undefined` where nothing since its last assignment says it. */
	at: Offset | undefined;
	/** Whether the cursor holds `at`, or only this pass knows it. */
	synced: boolean;
}

class CursorFold {
	/** Every position local this pass knows the value of, by name. Names are unique to the module. */
	private readonly positions = new Map<string, Offset>();
	/** The statement that sets the cursor to a number at the head of the function, and its list. */
	private init: { readonly list: ts.Statement[]; readonly index: number } | undefined;
	/** Whether the cursor still holds the number `init` set, with no read of it since. */
	private sinceInit = false;

	public constructor(
		private readonly ctx: EmitContext,
		private readonly cursor: string,
	) {}

	public fold(body: ReadonlyArray<ts.Statement>): ts.Statement[] {
		const out: ts.Statement[] = [];
		const state: State = { at: undefined, synced: true };
		for (const statement of body) {
			this.statement(statement, state, out, true);
		}
		return this.dropDeadStores(out);
	}

	private statement(statement: ts.Statement, state: State, out: ts.Statement[], top: boolean): void {
		const t = this.ctx.ts_;
		const f = this.ctx.factory;

		const init = top && this.init === undefined ? this.initialNumber(statement) : undefined;
		if (init !== undefined) {
			out.push(statement);
			this.init = { list: out, index: out.length - 1 };
			this.sinceInit = true;
			state.at = { base: undefined, offset: init };
			state.synced = true;
			return;
		}

		const declared = this.constDeclaration(statement);
		if (declared !== undefined) {
			const { name, initializer } = declared;
			// `const pos = cursor`: where the cursor's value is known, the
			// position is that value; where it is not, the position is the new
			// base the values after it are offsets from.
			if (t.isIdentifier(initializer) && initializer.text === this.cursor) {
				if (state.at !== undefined) {
					this.positions.set(name.text, state.at);
					return;
				}
				out.push(statement);
				this.sinceInit = false;
				const base = { base: name, offset: 0 };
				this.positions.set(name.text, base);
				state.at = base;
				state.synced = true;
				return;
			}
			// `const pos2 = pos1 + 4`.
			const value = this.readsPosition(initializer) ? this.offsetOf(initializer, state) : undefined;
			if (value !== undefined) {
				this.positions.set(name.text, value);
				return;
			}
		}

		const assigned = this.cursorAssignment(statement);
		if (assigned !== undefined) {
			// `cursor = pos + 4` moves only what this pass knows.
			const value = t.isIdentifier(assigned.left) ? this.offsetOf(assigned.right, state) : undefined;
			if (value !== undefined) {
				state.at = value;
				state.synced = false;
				return;
			}
			// Any other assignment reads the cursor's old value, if at all,
			// before it sets the new one, so where the cursor does not hold that
			// value its reads take it, and the cursor needs no assignment first.
			out.push(
				f.updateExpressionStatement(
					statement as ts.ExpressionStatement,
					f.updateBinaryExpression(
						assigned,
						assigned.left,
						assigned.operatorToken,
						this.substitute(assigned.right, state, this.substitutes(state))!,
					),
				),
			);
			this.sinceInit = false;
			state.at = undefined;
			state.synced = true;
			return;
		}

		if (!this.assignsCursor(statement)) {
			// A read of the cursor takes a number this pass knows in its place.
			// An offset from a position would add for each read, and again
			// where the cursor is assigned, so the cursor is assigned first.
			if (this.jumps(statement) || (state.at?.base !== undefined && this.readsCursorAtAll(statement))) {
				this.materialize(state, out);
			}
			const substituted = this.substitute(statement, state, this.substitutes(state));
			if (substituted !== undefined) {
				if (this.readsCursorAtAll(substituted)) {
					this.sinceInit = false;
				}
				out.push(substituted);
			}
			return;
		}

		if (t.isBlock(statement)) {
			// A `do ... end`: the statements after it follow on from its last,
			// except that a position declared inside it is out of scope after it.
			const inner: ts.Statement[] = [];
			const before = new Set(this.positions.keys());
			for (const each of statement.statements) {
				this.statement(each, state, inner, false);
			}
			if (state.at?.base !== undefined && !before.has(state.at.base.text)) {
				this.materialize(state, inner);
				state.at = undefined;
			}
			out.push(f.updateBlock(statement, inner));
			return;
		}

		if (t.isIfStatement(statement)) {
			this.materialize(state, out);
			// Another branch, or the code after it, may read the number the head
			// set, so a branch assigns the cursor rather than change the head.
			this.sinceInit = false;
			out.push(this.ifStatement(statement, state));
			this.sinceInit = false;
			state.at = undefined;
			state.synced = true;
			return;
		}

		if (
			t.isForOfStatement(statement) ||
			t.isForInStatement(statement) ||
			t.isForStatement(statement) ||
			t.isWhileStatement(statement) ||
			t.isDoStatement(statement)
		) {
			this.materialize(state, out);
			this.sinceInit = false;
			out.push(this.loop(statement));
			this.sinceInit = false;
			state.at = undefined;
			state.synced = true;
			return;
		}

		// Nothing else assigns the cursor in what the emitter writes; kept as
		// it is, with the cursor set first.
		this.materialize(state, out);
		out.push(this.substitute(statement, state, false) ?? statement);
		this.sinceInit = false;
		state.at = undefined;
		state.synced = true;
	}

	/** An `if`, entered with the cursor set to `state.at`: each branch ends with the cursor set. */
	private ifStatement(statement: ts.IfStatement, state: State): ts.IfStatement {
		const f = this.ctx.factory;
		const t = this.ctx.ts_;
		const entry = state.at;
		const condition = this.substitute(
			statement.expression,
			{ at: entry, synced: true },
			entry?.base === undefined,
		) as ts.Expression;
		const otherwise = statement.elseStatement;
		return f.updateIfStatement(
			statement,
			condition,
			this.branch(statement.thenStatement, entry),
			otherwise === undefined
				? undefined
				: t.isIfStatement(otherwise)
					? this.ifStatement(otherwise, { at: entry, synced: true })
					: this.branch(otherwise, entry),
		);
	}

	/**
	 * A loop. Its body runs with the cursor at a value no number says, and
	 * ends each pass with the cursor set; its header is read with the cursor
	 * as the loop leaves it.
	 */
	private loop(statement: ts.IterationStatement): ts.Statement {
		const f = this.ctx.factory;
		const t = this.ctx.ts_;
		const unknown: State = { at: undefined, synced: true };
		const header = (node: ts.Expression | undefined) =>
			node === undefined ? undefined : (this.substitute(node, unknown, false) as ts.Expression);
		const body = this.branch(statement.statement, undefined);
		if (t.isForOfStatement(statement)) {
			return f.updateForOfStatement(
				statement,
				statement.awaitModifier,
				statement.initializer,
				header(statement.expression)!,
				body,
			);
		}
		if (t.isForInStatement(statement)) {
			return f.updateForInStatement(statement, statement.initializer, header(statement.expression)!, body);
		}
		if (t.isForStatement(statement)) {
			const initializer = statement.initializer;
			return f.updateForStatement(
				statement,
				initializer === undefined || t.isVariableDeclarationList(initializer)
					? initializer === undefined
						? undefined
						: (this.substitute(initializer, unknown, false) as ts.VariableDeclarationList)
					: header(initializer),
				header(statement.condition),
				header(statement.incrementor),
				body,
			);
		}
		if (t.isWhileStatement(statement)) {
			return f.updateWhileStatement(statement, header(statement.expression)!, body);
		}
		const doStatement = statement as ts.DoStatement;
		return f.updateDoStatement(doStatement, body, header(doStatement.expression)!);
	}

	/** One branch or loop body, entered with the cursor holding `entry`, left with the cursor set. */
	private branch(statement: ts.Statement, entry: Offset | undefined): ts.Block {
		const t = this.ctx.ts_;
		const f = this.ctx.factory;
		const state: State = { at: entry, synced: true };
		const statements = t.isBlock(statement) ? statement.statements : [statement];
		const inner: ts.Statement[] = [];
		for (const each of statements) {
			this.statement(each, state, inner, false);
		}
		this.materialize(state, inner);
		return t.isBlock(statement) ? f.updateBlock(statement, inner) : f.createBlock(inner, true);
	}

	/**
	 * Whether a read of the cursor takes what this pass knows of it. A number
	 * costs a read no more than the cursor does, and leaves the cursor
	 * unread; an offset from a position costs an addition, and is taken only
	 * where the cursor does not hold it.
	 */
	private substitutes(state: State): boolean {
		return state.at !== undefined && (state.at.base === undefined || !state.synced);
	}

	/** Sets the cursor to what this pass knows of it, where it does not hold that already. */
	private materialize(state: State, out: ts.Statement[]): void {
		if (state.at === undefined || state.synced) {
			return;
		}
		const at = state.at;
		state.synced = true;
		if (this.sinceInit && at.base === undefined && this.init !== undefined) {
			// Nothing has read the cursor since the head of the function set it,
			// so that statement sets it to this number instead.
			const { list, index } = this.init;
			list[index] = this.withInitialNumber(list[index], at.offset);
			this.sinceInit = false;
			return;
		}
		this.sinceInit = false;
		out.push(this.ctx.assign(this.cursor, this.valueOf(at)));
	}

	private valueOf(at: Offset): ts.Expression {
		return at.base === undefined ? this.ctx.num(at.offset) : this.ctx.offsetFrom(at.base, at.offset);
	}

	/**
	 * Replaces each known position local in `node` with its value, and, with
	 * `readsCursor`, each read of the cursor with what `state` knows of it. A
	 * `const` computed from a known position inside `node` is folded the same
	 * way. Returns `undefined` for a statement that folds away entirely.
	 */
	private substitute<T extends ts.Node>(node: T, state: State, readsCursor: boolean): T | undefined {
		const t = this.ctx.ts_;
		const f = this.ctx.factory;
		const visit = (child: ts.Node): ts.Node | undefined => {
			if (t.isIdentifier(child)) {
				const known = this.positions.get(child.text);
				// A base is its own value.
				if (known !== undefined && !(known.offset === 0 && known.base?.text === child.text)) {
					return this.valueOf(known);
				}
				if (readsCursor && child.text === this.cursor && state.at !== undefined) {
					return this.valueOf(state.at);
				}
				return child;
			}
			// Names, not reads.
			if (t.isPropertyAccessExpression(child)) {
				return f.updatePropertyAccessExpression(
					child,
					t.visitNode(child.expression, visit, t.isExpression)!,
					child.name,
				);
			}
			if (t.isPropertyAssignment(child)) {
				return f.updatePropertyAssignment(
					child,
					child.name,
					t.visitNode(child.initializer, visit, t.isExpression)!,
				);
			}
			if (t.isVariableStatement(child)) {
				const declared = this.constDeclaration(child);
				if (declared !== undefined && this.readsPosition(declared.initializer)) {
					const value = this.offsetOf(
						declared.initializer,
						readsCursor ? state : { at: undefined, synced: true },
					);
					if (value !== undefined) {
						this.positions.set(declared.name.text, value);
						return undefined;
					}
				}
			}
			const visited = t.visitEachChild(child, visit, undefined);
			return t.isBinaryExpression(visited) ? this.foldSum(visited) : visited;
		};
		return t.visitNode(node, visit) as T | undefined;
	}

	/** `(p + 4) + 8` as `p + 12`, `4 + 8` as `12`, `9 + (n + 1)` as `n + 10`, and a sum with 0 as its other term. */
	private foldSum(node: ts.BinaryExpression): ts.Expression {
		const t = this.ctx.ts_;
		if (node.operatorToken.kind !== t.SyntaxKind.PlusToken) {
			return node;
		}
		// `0 + (len + 1)` and `9 + (len + 1)`, from a position the pass knows as a number.
		if (t.isNumericLiteral(node.left)) {
			const start = Number(node.left.text);
			let rest: ts.Expression = node.right;
			while (t.isParenthesizedExpression(rest)) {
				rest = rest.expression;
			}
			if (start === 0) {
				return node.right;
			}
			if (
				t.isBinaryExpression(rest) &&
				rest.operatorToken.kind === t.SyntaxKind.PlusToken &&
				t.isNumericLiteral(rest.right)
			) {
				return this.ctx.offsetFrom(rest.left, start + Number(rest.right.text));
			}
		}
		if (!t.isNumericLiteral(node.right)) {
			return node;
		}
		const right = Number(node.right.text);
		let left: ts.Expression = node.left;
		if (right === 0) {
			return left;
		}
		while (t.isParenthesizedExpression(left)) {
			left = left.expression;
		}
		if (t.isNumericLiteral(left)) {
			return this.ctx.num(Number(left.text) + right);
		}
		if (
			t.isBinaryExpression(left) &&
			left.operatorToken.kind === t.SyntaxKind.PlusToken &&
			t.isNumericLiteral(left.right)
		) {
			return this.ctx.offsetFrom(left.left, Number(left.right.text) + right);
		}
		return node;
	}

	/** The cursor value `node` computes, where it is a known position or the cursor plus constants. */
	private offsetOf(node: ts.Expression, state: State): Offset | undefined {
		const t = this.ctx.ts_;
		if (t.isParenthesizedExpression(node)) {
			return this.offsetOf(node.expression, state);
		}
		if (t.isNumericLiteral(node)) {
			return { base: undefined, offset: Number(node.text) };
		}
		if (t.isIdentifier(node)) {
			return node.text === this.cursor ? state.at : this.positions.get(node.text);
		}
		if (t.isBinaryExpression(node) && node.operatorToken.kind === t.SyntaxKind.PlusToken) {
			const left = this.offsetOf(node.left, state);
			if (left !== undefined && t.isNumericLiteral(node.right)) {
				return { base: left.base, offset: left.offset + Number(node.right.text) };
			}
		}
		return undefined;
	}

	/** Whether `node` reads a position local or the cursor, as against a number alone. */
	private readsPosition(node: ts.Node): boolean {
		const t = this.ctx.ts_;
		if (t.isIdentifier(node)) {
			return node.text === this.cursor || this.positions.has(node.text);
		}
		return t.forEachChild(node, (child) => this.readsPosition(child) || undefined) ?? false;
	}

	/** The number a statement at the head of the function sets the cursor to: `let cursor = 0` or `cursor = 0`. */
	private initialNumber(statement: ts.Statement): number | undefined {
		const t = this.ctx.ts_;
		if (t.isVariableStatement(statement)) {
			const [declaration, ...rest] = statement.declarationList.declarations;
			if (
				rest.length === 0 &&
				t.isIdentifier(declaration.name) &&
				declaration.name.text === this.cursor &&
				declaration.initializer !== undefined &&
				t.isNumericLiteral(declaration.initializer)
			) {
				return Number(declaration.initializer.text);
			}
			return undefined;
		}
		const assigned = this.cursorAssignment(statement);
		return assigned !== undefined && t.isIdentifier(assigned.left) && t.isNumericLiteral(assigned.right)
			? Number(assigned.right.text)
			: undefined;
	}

	private withInitialNumber(statement: ts.Statement, value: number): ts.Statement {
		const t = this.ctx.ts_;
		const f = this.ctx.factory;
		if (t.isVariableStatement(statement)) {
			const [declaration] = statement.declarationList.declarations;
			return f.updateVariableStatement(
				statement,
				statement.modifiers,
				f.updateVariableDeclarationList(statement.declarationList, [
					f.updateVariableDeclaration(
						declaration,
						declaration.name,
						declaration.exclamationToken,
						declaration.type,
						this.ctx.num(value),
					),
				]),
			);
		}
		return this.ctx.assign(this.cursor, this.ctx.num(value));
	}

	/** `const <name> = <initializer>`, one declaration. */
	private constDeclaration(
		statement: ts.Statement,
	): { readonly name: ts.Identifier; readonly initializer: ts.Expression } | undefined {
		const t = this.ctx.ts_;
		if (!t.isVariableStatement(statement) || (statement.declarationList.flags & t.NodeFlags.Const) === 0) {
			return undefined;
		}
		const [declaration, ...rest] = statement.declarationList.declarations;
		if (rest.length > 0 || !t.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return undefined;
		}
		return { name: declaration.name, initializer: declaration.initializer };
	}

	/** `cursor = <value>` or `[..., cursor, ...] = <value>`, as a statement of its own. */
	private cursorAssignment(statement: ts.Statement): ts.BinaryExpression | undefined {
		const t = this.ctx.ts_;
		if (!t.isExpressionStatement(statement)) {
			return undefined;
		}
		const expression = statement.expression;
		if (!t.isBinaryExpression(expression) || expression.operatorToken.kind !== t.SyntaxKind.EqualsToken) {
			return undefined;
		}
		const left = expression.left;
		const targets = t.isArrayLiteralExpression(left) ? left.elements : [left];
		return targets.some((target) => t.isIdentifier(target) && target.text === this.cursor) ? expression : undefined;
	}

	/** Whether anything in `node` assigns or declares the cursor, or reads it from a function of its own. */
	private assignsCursor(node: ts.Node): boolean {
		const t = this.ctx.ts_;
		const isCursor = (target: ts.Node): boolean =>
			(t.isIdentifier(target) && target.text === this.cursor) ||
			((t.isArrayLiteralExpression(target) || t.isParenthesizedExpression(target)) &&
				(t.forEachChild(target, (child) => isCursor(child) || undefined) ?? false));
		const visit = (child: ts.Node): boolean => {
			if (t.isBinaryExpression(child) && isAssignment(t, child.operatorToken.kind) && isCursor(child.left)) {
				return true;
			}
			if (
				(t.isPrefixUnaryExpression(child) || t.isPostfixUnaryExpression(child)) &&
				(child.operator === t.SyntaxKind.PlusPlusToken || child.operator === t.SyntaxKind.MinusMinusToken) &&
				isCursor(child.operand)
			) {
				return true;
			}
			if (t.isVariableDeclaration(child) && isCursor(child.name)) {
				return true;
			}
			if (t.isFunctionLike(child) && this.readsCursorAtAll(child)) {
				return true;
			}
			return t.forEachChild(child, (each) => visit(each) || undefined) ?? false;
		};
		return visit(node);
	}

	private readsCursorAtAll(node: ts.Node): boolean {
		const t = this.ctx.ts_;
		if (t.isIdentifier(node)) {
			return node.text === this.cursor;
		}
		return t.forEachChild(node, (child) => this.readsCursorAtAll(child) || undefined) ?? false;
	}

	/** Whether `node` leaves the loop around it early, past where the loop's body sets the cursor. */
	private jumps(node: ts.Node): boolean {
		const t = this.ctx.ts_;
		if (t.isBreakStatement(node) || t.isContinueStatement(node)) {
			return true;
		}
		if (t.isFunctionLike(node)) {
			return false;
		}
		return t.forEachChild(node, (child) => this.jumps(child) || undefined) ?? false;
	}

	/**
	 * Drops each assignment of the cursor that nothing reads before the
	 * cursor is assigned again or the function returns, working back from
	 * its end, and the cursor's declaration where nothing is left that reads
	 * or assigns it: a consumer's `noUnusedLocals` rejects a local that is
	 * only assigned. A loop is kept whole, since one pass may read what the
	 * last assigned.
	 */
	private dropDeadStores(out: ts.Statement[]): ts.Statement[] {
		const t = this.ctx.ts_;
		const [kept] = this.liveBefore(out, false);
		const declaration = kept.find(
			(statement) => t.isVariableStatement(statement) && this.initialNumber(statement) !== undefined,
		);
		if (declaration === undefined) {
			return kept;
		}
		const rest = kept.filter((statement) => statement !== declaration);
		return rest.some((statement) => this.readsCursorAtAll(statement)) ? kept : rest;
	}

	/** `statements` without their dead assignments of the cursor, and whether the cursor is read before it is next assigned. */
	private liveBefore(statements: ReadonlyArray<ts.Statement>, liveAfter: boolean): [ts.Statement[], boolean] {
		let live = liveAfter;
		const kept: ts.Statement[] = [];
		for (let index = statements.length - 1; index >= 0; index--) {
			const [statement, liveIn] = this.liveThrough(statements[index], live);
			if (statement !== undefined) {
				kept.unshift(statement);
			}
			live = liveIn;
		}
		return [kept, live];
	}

	private liveThrough(statement: ts.Statement, liveAfter: boolean): [ts.Statement | undefined, boolean] {
		const t = this.ctx.ts_;
		const f = this.ctx.factory;
		if (t.isReturnStatement(statement)) {
			return [statement, this.readsCursor(statement)];
		}
		const assigned = this.cursorAssignment(statement);
		if (assigned !== undefined) {
			const reads = this.readsCursor(assigned.right);
			if (liveAfter) {
				return [statement, reads];
			}
			if (t.isIdentifier(assigned.left)) {
				if (this.isPure(assigned.right)) {
					return [undefined, false];
				}
				// `cursor = writeLongString(...)`: the call stays, for its writes.
				return t.isCallExpression(assigned.right)
					? [f.createExpressionStatement(assigned.right), reads]
					: [statement, reads];
			}
			// `[buffer, capacity, cursor] = growLongString(...)`: the cursor's place goes.
			const targets = (assigned.left as ts.ArrayLiteralExpression).elements;
			const last = targets.length - 1;
			const elements = targets
				.map((target, index) =>
					t.isIdentifier(target) && target.text === this.cursor
						? index === last
							? undefined
							: f.createOmittedExpression()
						: target,
				)
				.filter((target): target is ts.Expression => target !== undefined);
			return [
				f.updateExpressionStatement(
					statement as ts.ExpressionStatement,
					f.updateBinaryExpression(
						assigned,
						f.createArrayLiteralExpression(elements),
						assigned.operatorToken,
						assigned.right,
					),
				),
				reads,
			];
		}
		if (t.isIfStatement(statement)) {
			return this.liveIf(statement, liveAfter);
		}
		if (t.isBlock(statement)) {
			const [inner, live] = this.liveBefore(statement.statements, liveAfter);
			return [f.updateBlock(statement, inner), live];
		}
		const isLoop =
			t.isForOfStatement(statement) ||
			t.isForInStatement(statement) ||
			t.isForStatement(statement) ||
			t.isWhileStatement(statement) ||
			t.isDoStatement(statement);
		return [statement, liveAfter || this.readsCursor(statement) || (isLoop && this.readsCursorAtAll(statement))];
	}

	private liveIf(statement: ts.IfStatement, liveAfter: boolean): [ts.IfStatement, boolean] {
		const t = this.ctx.ts_;
		const f = this.ctx.factory;
		const branch = (node: ts.Statement): [ts.Statement, boolean] => {
			if (t.isIfStatement(node)) {
				return this.liveIf(node, liveAfter);
			}
			const statements = t.isBlock(node) ? node.statements : [node];
			const [inner, live] = this.liveBefore(statements, liveAfter);
			return [t.isBlock(node) ? f.updateBlock(node, inner) : f.createBlock(inner, true), live];
		};
		const [then, liveThen] = branch(statement.thenStatement);
		const [otherwise, liveOtherwise] =
			statement.elseStatement === undefined ? [undefined, liveAfter] : branch(statement.elseStatement);
		return [
			f.updateIfStatement(statement, statement.expression, then, otherwise),
			liveThen || liveOtherwise || this.readsCursor(statement.expression),
		];
	}

	/** Whether `node` reads the cursor, other than as the target it assigns. */
	private readsCursor(node: ts.Node): boolean {
		const t = this.ctx.ts_;
		if (t.isIdentifier(node)) {
			return node.text === this.cursor;
		}
		if (
			t.isBinaryExpression(node) &&
			node.operatorToken.kind === t.SyntaxKind.EqualsToken &&
			(t.isIdentifier(node.left) || t.isArrayLiteralExpression(node.left))
		) {
			const targetReads = t.isArrayLiteralExpression(node.left)
				? node.left.elements.some((target) => !t.isIdentifier(target) && this.readsCursor(target))
				: false;
			return targetReads || this.readsCursor(node.right);
		}
		if (t.isVariableDeclaration(node)) {
			return node.initializer !== undefined && this.readsCursor(node.initializer);
		}
		return t.forEachChild(node, (child) => this.readsCursor(child) || undefined) ?? false;
	}

	/** Whether `node` reads only locals, numbers, properties and lengths, and so can go unevaluated. */
	private isPure(node: ts.Expression): boolean {
		const t = this.ctx.ts_;
		if (t.isIdentifier(node) || t.isNumericLiteral(node)) {
			return true;
		}
		if (t.isParenthesizedExpression(node)) {
			return this.isPure(node.expression);
		}
		if (t.isPropertyAccessExpression(node)) {
			return this.isPure(node.expression);
		}
		if (t.isBinaryExpression(node)) {
			const kind = node.operatorToken.kind;
			return (
				(kind === t.SyntaxKind.PlusToken ||
					kind === t.SyntaxKind.MinusToken ||
					kind === t.SyntaxKind.AsteriskToken) &&
				this.isPure(node.left) &&
				this.isPure(node.right)
			);
		}
		if (t.isCallExpression(node) && t.isPropertyAccessExpression(node.expression)) {
			const callee = node.expression;
			// `x.size()` and `buffer.len(x)`, which roblox-ts compiles to a length.
			if (callee.name.text === "size" && node.arguments.length === 0) {
				return this.isPure(callee.expression);
			}
			return (
				t.isIdentifier(callee.expression) &&
				callee.expression.text === "buffer" &&
				callee.name.text === "len" &&
				node.arguments.every((argument) => this.isPure(argument))
			);
		}
		return false;
	}
}

function isAssignment(t: typeof ts, kind: ts.SyntaxKind): boolean {
	return kind >= t.SyntaxKind.FirstAssignment && kind <= t.SyntaxKind.LastAssignment;
}

/** Folds the cursor named `cursor` through `body`, the statements of one function. */
export function foldCursor(ctx: EmitContext, body: ReadonlyArray<ts.Statement>, cursor: string): ts.Statement[] {
	return new CursorFold(ctx, cursor).fold(body);
}
