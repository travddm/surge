import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * A string beside fixed-size fields in each element, so no element has a size
 * of its own: each entry writes its name's length and bytes, then its score
 * and its user id.
 */
export interface LeaderboardEntry {
	name: string;
	score: DataType.u32;
	userId: DataType.f64;
}

export interface Leaderboard {
	entries: LeaderboardEntry[];
}

export interface FbsLeaderboard {
	entries: Array<{ name: string; score: Fbs.u32; userId: Fbs.f64 }>;
}

export interface SerioLeaderboard {
	entries: Array<{ name: string; score: Serio.u32; userId: Serio.f64 }>;
}
