//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Layout } from "./shapes";

export const checkedSerializer = createCodec<Layout>({ readChecks: true });
