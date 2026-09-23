//!native
//!optimize 2
import { DataType as Fbs, createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { Booleans as blinkBooleansCodec, Entities as blinkEntitiesCodec } from "../blink/server";

const BOOLEAN_COUNT = 1000;
const ENTITY_COUNT = 100;

/**
 * Blink's two published benchmark shapes, so a result here can be compared
 * against its own table. The exact `.blink` definitions are transcribed when
 * the Blink adapter lands (see docs/future-work/benchmark-tooling.md); these
 * are the shapes as that document records them.
 */
interface Booleans {
	values: boolean[];
}

interface Entity {
	a: DataType.u8;
	b: DataType.u8;
	c: DataType.u8;
	d: DataType.u8;
	e: DataType.u8;
	f: DataType.u8;
}

interface Entities {
	entities: Entity[];
}

interface FbsEntities {
	entities: Array<{ a: Fbs.u8; b: Fbs.u8; c: Fbs.u8; d: Fbs.u8; e: Fbs.u8; f: Fbs.u8 }>;
}

interface SerioEntities {
	entities: Array<{ a: Serio.u8; b: Serio.u8; c: Serio.u8; d: Serio.u8; e: Serio.u8; f: Serio.u8 }>;
}

const booleansSerializer = createBinarySerializer<Booleans>();
const entitiesSerializer = createBinarySerializer<Entities>();
const fbsBooleansSerializer = createFbsSerializer<Booleans>();
const fbsEntitiesSerializer = createFbsSerializer<FbsEntities>();
const serioBooleansSerializer = createSerioSerializer<Booleans>();
const serioEntitiesSerializer = createSerioSerializer<SerioEntities>();

const rng = new Rng(1721);

const values = new Array<boolean>();
for (const _ of $range(1, BOOLEAN_COUNT)) {
	values.push(rng.bool());
}

const entities = new Array<Entity>();
for (const _ of $range(1, ENTITY_COUNT)) {
	entities.push({
		a: rng.int(0, 255),
		b: rng.int(0, 255),
		c: rng.int(0, 255),
		d: rng.int(0, 255),
		e: rng.int(0, 255),
		f: rng.int(0, 255),
	});
}

export const blinkBooleans: Fixture = {
	name: "Blink: Booleans",
	note: `${BOOLEAN_COUNT} booleans in one array, a byte each, as Blink also writes them`,
	entries: [
		defineEntry<Booleans>("surge", { values }, surgeAdapter(booleansSerializer)),
		defineEntry<Booleans>("fbs", { values }, fbsAdapter(fbsBooleansSerializer)),
		defineEntry<Booleans>("serio", { values }, serioAdapter(serioBooleansSerializer)),
		defineEntry("blink", { values }, blinkAdapter(blinkBooleansCodec)),
		defineEntry(
			"zap",
			{ values },
			zapAdapter((zap) => zap.Bools),
		),
	],
};

export const blinkEntities: Fixture = {
	name: "Blink: Entities",
	note: `${ENTITY_COUNT} structs of six u8 fields`,
	entries: [
		defineEntry<Entities>("surge", { entities }, surgeAdapter(entitiesSerializer)),
		defineEntry<FbsEntities>("fbs", { entities }, fbsAdapter(fbsEntitiesSerializer)),
		defineEntry<SerioEntities>("serio", { entities }, serioAdapter(serioEntitiesSerializer)),
		defineEntry("blink", { entities }, blinkAdapter(blinkEntitiesCodec)),
		defineEntry(
			"zap",
			{ entities },
			zapAdapter((zap) => zap.Ents),
		),
	],
};
