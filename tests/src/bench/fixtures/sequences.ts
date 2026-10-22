//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2BlobAdapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { cursorAdapter } from "../adapters/surge-cursor";
import { fbsSerializer } from "../codecs/sequences/fbs";
import { flamework2Serializer } from "../codecs/sequences/flamework2";
import { serioSerializer } from "../codecs/sequences/serio";
import type { Effect, Effects } from "../codecs/sequences/shapes";
import { serializer } from "../codecs/sequences/surge";
import { checkedSerializer } from "../codecs/sequences/surge-checked";
import { cursorSerializer } from "../codecs/sequences/surge-cursor";

const COUNT = 20;
const MAX_KEYPOINTS = 8;
/** Keypoint times and sizes are multiples of this, which an `f32` holds exactly. */
const STEP = 1 / 64;

const rng = new Rng(7243);

/** From 0 to 1, rising: the times a sequence's keypoints must have. */
function keypointTimes(): Array<number> {
	const count = rng.int(2, MAX_KEYPOINTS);
	const steps = new Set<number>();
	while (steps.size() < count - 2) {
		steps.add(rng.int(1, 1 / STEP - 1));
	}
	const inner = [...steps].map((step) => step * STEP);
	inner.sort((left, right) => left < right);
	return [0, ...inner, 1];
}

const effects = new Array<Effect>();
for (const _ of $range(1, COUNT)) {
	const colors = keypointTimes().map(
		(time) => new ColorSequenceKeypoint(time, Color3.fromRGB(rng.int(0, 255), rng.int(0, 255), rng.int(0, 255))),
	);
	// Sizes stay within 0 to 1, which serio's sequence encoding requires.
	const sizes = keypointTimes().map((time) => new NumberSequenceKeypoint(time, rng.int(0, 1 / STEP) * STEP, 0));
	effects.push({ color: new ColorSequence(colors), size: new NumberSequence(sizes) });
}

export const sequences: Fixture = {
	name: "sequences",
	note: `${COUNT} effects of a ColorSequence and a NumberSequence of 2 to ${MAX_KEYPOINTS} keypoints each`,
	entries: [
		defineEntry<Effects>("surge", { effects }, surgeAdapter(serializer)),
		defineEntry<Effects>("surge (cursor)", { effects }, cursorAdapter(cursorSerializer)),
		defineEntry<Effects>("surge (readChecks)", { effects }, surgeAdapter(checkedSerializer)),
		defineEntry<Effects>("fbs", { effects }, fbsAdapter(fbsSerializer)),
		defineEntry<Effects>("serio", { effects }, serioAdapter(serioSerializer)),
		defineEntry<Effects>("flamework2", { effects }, flamework2BlobAdapter(flamework2Serializer)),
	],
};
