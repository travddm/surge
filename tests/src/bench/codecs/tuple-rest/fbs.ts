//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { FbsReadings } from "./shapes";

export const fbsSerializer = createFbsSerializer<FbsReadings>();
