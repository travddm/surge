//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";

import type { Layout } from "./shapes";

export const fbsSerializer = createFbsSerializer<Layout>();
