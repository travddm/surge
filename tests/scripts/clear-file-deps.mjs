// tests/.npmrc's install-links=true copies each `file:` dependency, and `npm install` treats an
// existing copy as up to date while its version is unchanged, so edits to either package's source
// never reach tests/node_modules. Deleting the copies forces `npm install` to re-pack both.
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const nodeModules = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules");

for (const name of ["@rbxts/surge", "rbxts-transformer-surge"]) {
	rmSync(join(nodeModules, name), { recursive: true, force: true });
}
