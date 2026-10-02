//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { StringHeavy } from "./shapes";

export const fbsSerializer = createFbsSerializer<StringHeavy>();
