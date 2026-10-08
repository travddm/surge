// `rojo build` does not create its output directory if it's missing, and dist/ is gitignored, so
// it never exists on a clean checkout -- this runs before every `rojo build` invocation instead.
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
