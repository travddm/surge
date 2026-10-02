//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { Booleans } from "./shapes";

export const fbsBooleansSerializer = createFbsSerializer<Booleans>();
