import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * Blink's two published benchmark shapes, so a result here can be compared
 * against its own table. Their `.blink` twins in ../definitions/catalog.blink
 * are transcribed from Blink's own benchmark definitions, at the commit pinned
 * in docs/research/type-coverage-across-libraries.md.
 */
export interface Booleans {
	values: boolean[];
}

export interface Entity {
	a: DataType.u8;
	b: DataType.u8;
	c: DataType.u8;
	d: DataType.u8;
	e: DataType.u8;
	f: DataType.u8;
}

export interface Entities {
	entities: Entity[];
}

export interface FbsEntities {
	entities: Array<{ a: Fbs.u8; b: Fbs.u8; c: Fbs.u8; d: Fbs.u8; e: Fbs.u8; f: Fbs.u8 }>;
}

export interface SerioEntities {
	entities: Array<{ a: Serio.u8; b: Serio.u8; c: Serio.u8; d: Serio.u8; e: Serio.u8; f: Serio.u8 }>;
}
