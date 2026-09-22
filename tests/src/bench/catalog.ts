//!optimize 2
import type { Fixture } from "./adapter";
import { blinkBooleans, blinkEntities } from "./fixtures/blink-benches";
import { cframeArray, cframeArrayPackedAligned, cframeArrayPackedArbitrary } from "./fixtures/cframes";
import { enumHeavy } from "./fixtures/enum-heavy";
import { guardedUnion } from "./fixtures/guarded-union";
import { largeArray } from "./fixtures/large-array";
import { largeRecord } from "./fixtures/large-record";
import { nestedObject } from "./fixtures/nested-object";
import { packedStruct, unpackedStruct } from "./fixtures/packed-struct";
import { smallFlatStruct } from "./fixtures/small-flat-struct";
import { stringHeavy } from "./fixtures/string-heavy";
import { taggedUnion } from "./fixtures/tagged-union";
import { wideStruct } from "./fixtures/wide-struct";

/**
 * The one fixture catalog both benchmark tiers read: the size run under Lune
 * (size.ts) and the speed run under real Roblox (speed.spec.ts). The rows are
 * the list in docs/future-work/benchmark-tooling.md. Each library's adapter
 * drives this same catalog, so a size delta between two libraries is a format
 * difference and nothing else; only surge's adapter exists so far.
 */
export const CATALOG: ReadonlyArray<Fixture> = [
	smallFlatStruct,
	nestedObject,
	wideStruct,
	largeArray,
	largeRecord,
	stringHeavy,
	enumHeavy,
	taggedUnion,
	guardedUnion,
	unpackedStruct,
	packedStruct,
	cframeArray,
	cframeArrayPackedAligned,
	cframeArrayPackedArbitrary,
	blinkBooleans,
	blinkEntities,
];
