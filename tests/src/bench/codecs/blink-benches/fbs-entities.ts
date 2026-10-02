//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { FbsEntities } from "./shapes";

export const fbsEntitiesSerializer = createFbsSerializer<FbsEntities>();
