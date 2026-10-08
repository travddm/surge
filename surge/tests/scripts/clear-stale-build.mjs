// Deletes the build state that npm and tsc each report as up to date after a sibling package
// changed, so that `npm run tests:install && npm run tests:compile` really does build what the
// current source says.
//
// tests/.npmrc's install-links=true copies each `file:` dependency, and `npm install` treats an
// existing copy as up to date while its version is unchanged, so edits to either package's source
// never reach tests/node_modules. Deleting the copies forces `npm install` to re-pack both.
//
// tests/tsconfig.json sets `incremental`, and the transformer is a tsconfig plugin, not an input
// file: with tests/src/ unchanged, rbxtsc reuses the previous emit and the new transformer never
// runs. Nothing about that is visible in the output, so a golden check, a round-trip run, and a
// benchmark would all read the previous transformer's code. Deleting the build info forces a full
// emit. The watch and plain-compile tasks keep theirs, since editing tests/src/ does invalidate
// it.
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tests = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const name of ["@rbxts/surge", "rbxts-transformer-surge"]) {
	rmSync(join(tests, "node_modules", name), { recursive: true, force: true });
}
rmSync(join(tests, "out", "tsconfig.tsbuildinfo"), { force: true });
