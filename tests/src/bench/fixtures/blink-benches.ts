//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { Booleans as blinkBooleansCodec, Entities as blinkEntitiesCodec } from "../blink/server";
import { fbsBooleansSerializer } from "../codecs/blink-benches/fbs-booleans";
import { fbsEntitiesSerializer } from "../codecs/blink-benches/fbs-entities";
import { serioBooleansSerializer } from "../codecs/blink-benches/serio-booleans";
import { serioEntitiesSerializer } from "../codecs/blink-benches/serio-entities";
import type { Booleans, Entities, Entity, FbsEntities, SerioEntities } from "../codecs/blink-benches/shapes";
import { booleansSerializer } from "../codecs/blink-benches/surge-booleans";
import { entitiesSerializer } from "../codecs/blink-benches/surge-entities";

const BOOLEAN_COUNT = 1000;
const ENTITY_COUNT = 100;

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
