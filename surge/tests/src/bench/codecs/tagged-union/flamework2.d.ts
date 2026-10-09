// Declares the generated module beside this file (Benchmark harness 4.10 in
// docs/specs/benchmark-harness.md). Its bytes follow the shape in tests/flamework2/src/; the
// row's surge shape types the sample value it is given.
import type { Flamework2Serializer } from "../../adapters/flamework2";
import type { TaggedUnion } from "./shapes";

export declare const flamework2Serializer: Flamework2Serializer<TaggedUnion>;
