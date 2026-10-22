//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface LeaderboardEntry {
	name: string;
	score: Serialization.u32;
	userId: Serialization.f64;
}

interface Leaderboard {
	entries: LeaderboardEntry[];
}

export const flamework2Serializer = Flamework.createSerializer<Leaderboard>();
