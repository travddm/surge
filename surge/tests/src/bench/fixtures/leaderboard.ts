//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { leaderboard as baselineCodec } from "../baseline/codecs";
import { Leaderboard as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/leaderboard/fbs";
import { serioSerializer } from "../codecs/leaderboard/serio";
import type { FbsLeaderboard, Leaderboard, LeaderboardEntry, SerioLeaderboard } from "../codecs/leaderboard/shapes";
import { serializer } from "../codecs/leaderboard/surge";

const COUNT = 50;

const rng = new Rng(4409);
const entries = new Array<LeaderboardEntry>();
for (const _ of $range(1, COUNT)) {
	entries.push({ name: rng.str(20), score: rng.int(0, 1_000_000), userId: rng.int(1, 9_000_000_000) });
}

export const leaderboard: Fixture = {
	name: "leaderboard",
	note: `${COUNT} entries of a name of up to 20 bytes, a u32 and an f64`,
	entries: [
		defineEntry<Leaderboard>("surge", { entries }, surgeAdapter(serializer)),
		defineEntry<FbsLeaderboard>("fbs", { entries }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioLeaderboard>("serio", { entries }, serioAdapter(serioSerializer)),
		defineEntry("blink", { entries }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ entries },
			zapAdapter((zap) => zap.Scores),
		),
		defineEntry("baseline", { entries }, baselineAdapter(baselineCodec)),
	],
};
