// Makes the one-package tags of a commit: for each package, a commit whose root is the package's
// directory, and a tag on it. npm installs a package from a git tag only from the root of the
// tagged commit (docs/architecture.md), so a build of one package needs a commit of its own.
//
//   node scripts/tag-packages.mjs <next|dev> [<commit>] [--push]
//
// `next` makes the pre-release tags of a commit on master, `surge-v<version>-next.<N>`, and `dev`
// the dev tags of a commit on any branch, `surge-v<version>-dev-<short hash>`; the transformer's
// tag starts `transformer-v`. CI runs it once the checks pass (docs/contributing.md). Without
// `--push`, it makes the commits and tags in the local repository only.
//
// - The version is the one in the commit's package.json, or its next patch once the release tag
//   `v<version>` exists, so a pre-release sorts below the release it leads to and above the one
//   before. The tag's version is written into the new commit's package.json. That commit has no
//   parent and is on no branch, so nothing else sees the change.
// - N counts the commit's ancestors, itself included, that no release tag holds. Each commit on
//   master has more of them than the one before it, so no two share an N, and pushes need not tag
//   one at a time. Run again on the same commit, it finds the tags and makes none.
// - In `dev-<short hash>`, the hyphen makes one identifier of the two: as an identifier of its
//   own, an all-digit hash with a leading zero, such as `0123456`, is not a valid version.
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const PACKAGES = [
	{ directory: "surge", prefix: "surge" },
	{ directory: "rbxts-transformer-surge", prefix: "transformer" },
];

const RELEASE_TAG_PATTERN = "v[0-9]*";

function gitOutput(args, input) {
	return execFileSync("git", args, { encoding: "utf8", input });
}

function git(args, input) {
	return gitOutput(args, input).trim();
}

function fail(message) {
	console.error(`tag-packages: ${message}`);
	process.exit(1);
}

/** The version a tag of `version`'s package takes: `version`, or its next patch once it is released. */
function baseVersion(version, releaseTags) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	if (match === null) {
		fail(`package.json version ${version} is not a plain major.minor.patch`);
	}
	const [, major, minor, patch] = match;
	return releaseTags.has(`v${version}`) ? `${major}.${minor}.${Number(patch) + 1}` : version;
}

function prereleaseSuffix(kind, commit) {
	if (kind === "next") {
		return `next.${git(["rev-list", "--count", commit, "--not", `--tags=${RELEASE_TAG_PATTERN}`])}`;
	}
	return `dev-${git(["rev-parse", "--short=7", commit])}`;
}

/** The package's tree at `commit`, with `version` written into its package.json. */
function treeWithVersion(commit, directory, version) {
	const path = `${directory}/package.json`;
	const text = gitOutput(["show", `${commit}:${path}`]);
	const written = text.replace(/^(\t"version": )"[^"]*"/m, `$1"${version}"`);
	const before = JSON.parse(text);
	if (!isDeepStrictEqual(JSON.parse(written), { ...before, version })) {
		fail(`could not write the version into ${path}`);
	}
	const blob = git(["hash-object", "-w", "--stdin"], written);
	const entries = git(["ls-tree", "-z", `${commit}:${directory}`])
		.split("\0")
		.filter((entry) => entry !== "")
		.map((entry) => (entry.endsWith("\tpackage.json") ? entry.replace(/ [0-9a-f]+\t/, ` ${blob}\t`) : entry));
	return git(["mktree", "-z"], entries.join("\0") + "\0");
}

const args = process.argv.slice(2);
const push = args.includes("--push");
const [kind, revision = "HEAD"] = args.filter((arg) => arg !== "--push");
if (kind !== "next" && kind !== "dev") {
	fail("usage: node scripts/tag-packages.mjs <next|dev> [<commit>] [--push]");
}
// A shallow clone counts only the commits it holds, and holds no release tag.
if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
	fail("the repository is a shallow clone; fetch its whole history and its tags first");
}

const commit = git(["rev-parse", "--verify", `${revision}^{commit}`]);
const releaseTags = new Set(git(["tag", "--list", RELEASE_TAG_PATTERN]).split("\n"));
const suffix = prereleaseSuffix(kind, commit);
const tags = PACKAGES.map(({ directory, prefix }) => {
	const version = `${baseVersion(JSON.parse(git(["show", `${commit}:${directory}/package.json`])).version, releaseTags)}-${suffix}`;
	return { directory, prefix, version, name: `${prefix}-v${version}` };
});

const existing = tags.filter(({ name }) =>
	push ? git(["ls-remote", "--tags", "origin", `refs/tags/${name}`]) !== "" : git(["tag", "--list", name]) !== "",
);
if (existing.length === tags.length) {
	console.log(`tag-packages: ${tags.map(({ name }) => name).join(" and ")} exist already`);
	process.exit(0);
}
if (existing.length > 0) {
	fail(`${existing.map(({ name }) => name).join(" and ")} exists, but not the other`);
}

for (const tag of tags) {
	const tree = treeWithVersion(commit, tag.directory, tag.version);
	const tagged = git(["commit-tree", tree, "-m", `${tag.prefix} ${tag.version}\n\nFrom ${commit}.`]);
	// A lightweight tag, made whatever the local git config says about signing tags. The empty
	// old value makes the update fail if the tag exists.
	git(["update-ref", `refs/tags/${tag.name}`, tagged, ""]);
	console.log(`tag-packages: ${tag.name} -> ${tagged}`);
}
if (push) {
	git(["push", "--atomic", "origin", ...tags.map(({ name }) => `refs/tags/${name}`)]);
	console.log("tag-packages: pushed");
}
