// Makes the one-package tags of a commit: for each package, a commit whose root is the package's
// directory, and a tag on it. npm installs a package from a git tag only from the root of the
// tagged commit (docs/architecture.md), so a build of one package needs a commit of its own.
//
//   node scripts/tag-packages.mjs <next|dev> [<commit>] [--push]
//
// `next` makes the pre-release tags of a commit on master, `surge-v<version>-next.<N>`, and `dev`
// the dev tags of a commit on any branch, `surge-v<version>-dev-<hash>`, where `<hash>` is the
// commit's first seven hex digits; the transformer's tag starts `transformer-v`. CI runs it once
// the checks pass (docs/contributing.md). Without `--push`, it makes the commits and tags in the
// local repository only. With it, it reads the release tags from origin first.
//
// - The version is the one in the commit's package.json, or its next patch once the release tag
//   `v<version>` exists, so a pre-release sorts below the release it leads to and above the one
//   before. The tag's version is written into the new commit's package.json. That commit has no
//   parent and is on no branch, so nothing else sees the change.
// - N counts the commit's ancestors, itself included, that no release tag holds. Each commit on
//   master has more of them than the one before it, so no two share an N, and pushes need not tag
//   one at a time. A commit a release holds has none, and takes no pre-release tags.
// - Each tagged commit's message names the commit it was made from. Run again on the same
//   commit, the script finds its tags and makes none; a tag of the same name made from another
//   commit fails the run instead.
// - In `dev-<hash>`, the hyphen makes one identifier of the two: as an identifier of its own, an
//   all-digit hash with a leading zero, such as `0123456`, is not a valid version.
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

/** The package's tree at `commit`, with `version` written into `packageJson`, its package.json. */
function treeWithVersion(commit, directory, packageJson, version) {
	const written = packageJson.replace(/^(\t"version": )"[^"]*"/m, `$1"${version}"`);
	if (!isDeepStrictEqual(JSON.parse(written), { ...JSON.parse(packageJson), version })) {
		fail(`could not write the version into ${directory}/package.json`);
	}
	const blob = git(["hash-object", "-w", "--stdin"], written);
	const entries = git(["ls-tree", "-z", `${commit}:${directory}`])
		.split("\0")
		.filter((entry) => entry !== "")
		.map((entry) => (entry.endsWith("\tpackage.json") ? entry.replace(/ [0-9a-f]+\t/, ` ${blob}\t`) : entry));
	return git(["mktree", "-z"], entries.join("\0") + "\0");
}

/** The tags among `names` that origin has, by name, with the commit each names. */
function tagsOnOrigin(names) {
	const found = new Map();
	for (const line of git(["ls-remote", "--tags", "origin", ...names.map((name) => `refs/tags/${name}`)]).split(
		"\n",
	)) {
		const [hash, ref] = line.split("\t");
		if (ref !== undefined) {
			found.set(ref.replace("refs/tags/", ""), hash);
		}
	}
	if (found.size > 0) {
		// The tagged commits themselves, so that their messages can be read.
		git(["fetch", "--quiet", "origin", ...[...found.keys()].map((name) => `refs/tags/${name}`)]);
	}
	return found;
}

/** The tags among `names` that the local repository has, by name, with the commit each names. */
function tagsHere(names) {
	return new Map(
		names
			.map((name) => [
				name,
				git(["tag", "--list", name]) === "" ? undefined : git(["rev-parse", `${name}^{commit}`]),
			])
			.filter(([, hash]) => hash !== undefined),
	);
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
if (push) {
	// A refspec takes no `[0-9]`; of this repository's tags, only release tags start with `v`.
	git(["fetch", "--quiet", "origin", "refs/tags/v*:refs/tags/v*"]);
}

const commit = git(["rev-parse", "--verify", `${revision}^{commit}`]);
const releaseTags = new Set(git(["tag", "--list", RELEASE_TAG_PATTERN]).split("\n"));
let suffix = `dev-${commit.slice(0, 7)}`;
if (kind === "next") {
	const count = Number(git(["rev-list", "--count", commit, "--not", `--tags=${RELEASE_TAG_PATTERN}`]));
	if (count === 0) {
		console.log(`tag-packages: a release holds ${commit}, so it takes no pre-release tags`);
		process.exit(0);
	}
	suffix = `next.${count}`;
}
const tags = PACKAGES.map(({ directory, prefix }) => {
	const packageJson = gitOutput(["show", `${commit}:${directory}/package.json`]);
	const version = `${baseVersion(JSON.parse(packageJson).version, releaseTags)}-${suffix}`;
	return { directory, prefix, packageJson, version, name: `${prefix}-v${version}` };
});
const names = tags.map(({ name }) => name);

const here = tagsHere(names);
const existing = push ? tagsOnOrigin(names) : here;
if (existing.size === tags.length) {
	for (const [name, hash] of existing) {
		const source = /^From ([0-9a-f]{40})\.$/m.exec(git(["log", "-1", "--format=%B", hash]))?.[1];
		if (source !== commit) {
			fail(`${name} exists already, made from ${source ?? "no commit this script names"}, not ${commit}`);
		}
	}
	console.log(`tag-packages: ${names.join(" and ")} exist already`);
	process.exit(0);
}
if (existing.size > 0) {
	fail(`${[...existing.keys()].join(" and ")} exists, but not the other`);
}
if (here.size > 0) {
	const verb = here.size > 1 ? "exist" : "exists";
	fail(`${[...here.keys()].join(" and ")} ${verb} here but not on origin; delete the local tags first`);
}

const refs = tags.map((tag) => {
	const tree = treeWithVersion(commit, tag.directory, tag.packageJson, tag.version);
	const tagged = git(["commit-tree", tree, "-m", `${tag.prefix} ${tag.version}\n\nFrom ${commit}.`]);
	console.log(`tag-packages: ${tag.name} -> ${tagged}`);
	return `create refs/tags/${tag.name} ${tagged}\n`;
});
// Lightweight tags, made whatever the local git config says about signing tags. One update-ref
// run makes both or neither, and `create` fails if a tag exists.
git(["update-ref", "--stdin"], refs.join(""));
if (push) {
	git(["push", "--atomic", "origin", ...names.map((name) => `refs/tags/${name}`)]);
	console.log("tag-packages: pushed");
}
