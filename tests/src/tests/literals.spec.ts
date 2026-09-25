//!optimize 2
import { Assert, Fact, InlineData, Theory } from "@rbxts/runit";
import { createCodec } from "@rbxts/surge";

import { Rng, difference } from "../support";

type Direction = "north" | "east" | "south" | "west";
type Level = 1 | 2 | 3;
type Mixed = "auto" | 0 | false;

interface WithLiterals {
	direction: Direction;
	level: Level;
	mixed: Mixed;
	maybe: "on" | "off" | undefined;
}
const literalsSerializer = createCodec<WithLiterals>();

interface WithConstants {
	version: 3;
	tag: "header";
	enabled: true;
	payload: number;
}
const constantsSerializer = createCodec<WithConstants>();

enum Suit {
	Clubs,
	Diamonds,
	Hearts,
	Spades,
}
enum Color {
	Red = "red",
	Green = "green",
}
interface WithTsEnums {
	suit: Suit;
	color: Color;
	single: Suit.Hearts;
}
const tsEnumsSerializer = createCodec<WithTsEnums>();

// A negative literal is a minus sign applied to a number literal, and the
// generated code has to build it that way.
type Turn = -1 | 0 | 1;
const turnSerializer = createCodec<{ turn: Turn; ahead: -2 }>();

const DIRECTIONS: ReadonlyArray<Direction> = ["north", "east", "south", "west"];
const LEVELS: ReadonlyArray<Level> = [1, 2, 3];
const MIXED: ReadonlyArray<Mixed> = ["auto", 0, false];
const MAYBE: ReadonlyArray<"on" | "off"> = ["on", "off"];

class LiteralsTest {
	@Theory
	@InlineData("north", 1, "auto", "on")
	@InlineData("west", 3, 0, "off")
	@InlineData("south", 2, false, undefined)
	public roundTripsLiteralUnions(direction: Direction, level: Level, mixed: Mixed, maybe?: "on" | "off"): void {
		const value: WithLiterals = { direction, level, mixed, maybe };
		const buf = literalsSerializer.serialize(value);
		// One u8 index per field.
		Assert.equal(4, buffer.len(buf));
		Assert.equal(undefined, difference(value, literalsSerializer.deserialize(buf)));
	}

	@Theory
	@InlineData(-1)
	@InlineData(0)
	@InlineData(1)
	public roundTripsANegativeLiteral(turn: Turn): void {
		const value = { turn, ahead: -2 as const };
		const buf = turnSerializer.serialize(value);
		// Index 0 of -1, 0, 1 is -1, and `ahead` is a constant.
		Assert.equal(1, buffer.len(buf));
		Assert.equal(undefined, difference(value, turnSerializer.deserialize(buf)));
	}

	@Fact
	public writesNoBytesForASingleLiteral(): void {
		const value: WithConstants = { version: 3, tag: "header", enabled: true, payload: 9 };
		const buf = constantsSerializer.serialize(value);
		// Only `payload`.
		Assert.equal(8, buffer.len(buf));
		Assert.equal(undefined, difference(value, constantsSerializer.deserialize(buf)));
	}

	@Theory
	@InlineData(Suit.Clubs, Color.Red)
	@InlineData(Suit.Spades, Color.Green)
	public roundTripsTypeScriptEnums(suit: Suit, color: Color): void {
		const value: WithTsEnums = { suit, color, single: Suit.Hearts };
		const buf = tsEnumsSerializer.serialize(value);
		// `single` has one possible value and takes no bytes.
		Assert.equal(2, buffer.len(buf));
		Assert.equal(undefined, difference(value, tsEnumsSerializer.deserialize(buf)));
	}

	@Fact
	public roundTripsRandomLiterals(): void {
		const rng = new Rng(6);
		for (const _ of $range(1, 100)) {
			const value: WithLiterals = {
				direction: rng.pick(DIRECTIONS),
				level: rng.pick(LEVELS),
				mixed: rng.pick(MIXED),
				maybe: rng.bool() ? rng.pick(MAYBE) : undefined,
			};
			const buffer = literalsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, literalsSerializer.deserialize(buffer)));
		}
	}
}

export = LiteralsTest;
