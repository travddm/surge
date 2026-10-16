//!native
//!optimize 2
import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { FbsToggles } from "./shapes";

export const fbsPackedSerializer = createFbsSerializer<Fbs.Packed<FbsToggles>>();
