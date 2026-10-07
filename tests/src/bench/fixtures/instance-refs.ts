//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineBlobAdapter } from "../adapters/baseline";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { instanceRefs as baselineCodec } from "../baseline/codecs";
import { fbsSerializer } from "../codecs/instance-refs/fbs";
import { serioSerializer } from "../codecs/instance-refs/serio";
import type { FbsInstanceRefs, InstanceRef, InstanceRefs, SerioInstanceRefs } from "../codecs/instance-refs/shapes";
import { serializer } from "../codecs/instance-refs/surge";

const COUNT = 50;

const rng = new Rng(6271);
const entries = new Array<InstanceRef>();
for (const _ of $range(1, COUNT)) {
	entries.push({ model: new Instance("Part"), health: rng.int(0, 65535) });
}

export const instanceRefs: Fixture = {
	name: "instance references",
	note: `${COUNT} entries of an Instance and a u16: one value beside the bytes each`,
	entries: [
		defineEntry<InstanceRefs>("surge", { entries }, surgeAdapter(serializer)),
		defineEntry<FbsInstanceRefs>("fbs", { entries }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioInstanceRefs>("serio", { entries }, serioAdapter(serioSerializer)),
		defineEntry("baseline", { entries }, baselineBlobAdapter(baselineCodec)),
	],
};
