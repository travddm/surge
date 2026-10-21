//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { cursorAdapter } from "../adapters/surge-cursor";
import { fbsSerializer } from "../codecs/layout/fbs";
import { flamework2Serializer } from "../codecs/layout/flamework2";
import { serioSerializer } from "../codecs/layout/serio";
import type { Element, Layout } from "../codecs/layout/shapes";
import { serializer } from "../codecs/layout/surge";
import { checkedSerializer } from "../codecs/layout/surge-checked";
import { cursorSerializer } from "../codecs/layout/surge-cursor";

const COUNT = 50;
/** A `UDim`'s scale is a multiple of this, which an `f32` holds exactly. */
const SCALE_STEP = 1 / 64;

const rng = new Rng(9433);
const elements = new Array<Element>();
for (const _ of $range(1, COUNT)) {
	elements.push({
		offset: new Vector2(rng.f32(), rng.f32()),
		tint: Color3.fromRGB(rng.int(0, 255), rng.int(0, 255), rng.int(0, 255)),
		size: new UDim2(
			rng.int(0, 1 / SCALE_STEP) * SCALE_STEP,
			rng.int(0, 2000),
			rng.int(0, 1 / SCALE_STEP) * SCALE_STEP,
			rng.int(0, 2000),
		),
	});
}

export const layout: Fixture = {
	name: "layout",
	note: `${COUNT} elements of a Vector2, a Color3 and a UDim2`,
	entries: [
		defineEntry<Layout>("surge", { elements }, surgeAdapter(serializer)),
		defineEntry<Layout>("surge (cursor)", { elements }, cursorAdapter(cursorSerializer)),
		defineEntry<Layout>("surge (readChecks)", { elements }, surgeAdapter(checkedSerializer)),
		defineEntry<Layout>("fbs", { elements }, fbsAdapter(fbsSerializer)),
		defineEntry<Layout>("serio", { elements }, serioAdapter(serioSerializer)),
		defineEntry<Layout>("flamework2", { elements }, flamework2Adapter(flamework2Serializer)),
	],
};
