//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { FbsInstanceRefs } from "./shapes";

export const fbsSerializer = createFbsSerializer<FbsInstanceRefs>();
