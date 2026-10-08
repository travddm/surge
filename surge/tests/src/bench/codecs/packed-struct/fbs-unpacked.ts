//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { FbsToggles } from "./shapes";

export const fbsUnpackedSerializer = createFbsSerializer<FbsToggles>();
