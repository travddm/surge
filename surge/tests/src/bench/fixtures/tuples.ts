//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { tuples as baselineCodec } from "../baseline/codecs";
import { fbsSerializer } from "../codecs/tuples/fbs";
import { flamework2Serializer } from "../codecs/tuples/flamework2";
import { serioSerializer } from "../codecs/tuples/serio";
import type { FbsSamples, Sample, Samples, SerioSamples } from "../codecs/tuples/shapes";
import { serializer } from "../codecs/tuples/surge";

const COUNT = 50;

const rng = new Rng(3307);
const samples = new Array<Sample>();
for (const _ of $range(1, COUNT)) {
	samples.push([rng.int(0, 65535), rng.f32(), rng.f32()]);
}

export const tuples: Fixture = {
	name: "tuples",
	note: `${COUNT} tuples of a u16 and two f32`,
	entries: [
		defineEntry<Samples>("surge", { samples }, surgeAdapter(serializer)),
		defineEntry<FbsSamples>("fbs", { samples }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioSamples>("serio", { samples }, serioAdapter(serioSerializer)),
		defineEntry<Samples>("flamework2", { samples }, flamework2Adapter(flamework2Serializer)),
		defineEntry("baseline", { samples }, baselineAdapter(baselineCodec)),
	],
};
