//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { FbsIdSet } from "./shapes";

export const fbsSerializer = createFbsSerializer<FbsIdSet>();
