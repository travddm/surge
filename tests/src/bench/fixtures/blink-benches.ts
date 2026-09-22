import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

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

const booleansSerializer = createBinarySerializer<Booleans>();
const entitiesSerializer = createBinarySerializer<Entities>();

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

export const blinkBooleans = defineFixture<Booleans>(
	"Blink: Booleans",
	`${BOOLEAN_COUNT} booleans in one array, a byte each, as Blink also writes them`,
	{ values },
	surgeAdapter(booleansSerializer),
);

export const blinkEntities = defineFixture<Entities>(
	"Blink: Entities",
	`${ENTITY_COUNT} structs of six u8 fields`,
	{ entities },
	surgeAdapter(entitiesSerializer),
);
