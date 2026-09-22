// Runs the speed tier (Tier 2 of docs/future-work/benchmark-tooling.md) and writes
// ../docs/benchmarks/speed.md from what it printed, via `mise run bench:speed`.
//
// A Roblox process cannot write a file, so src/bench/speed.spec.ts prints one `BENCH_ROW:` line
// per fixture, library, and half, and src/index.ts closes with `BENCH_RESULT:`. This forwards
// every line it is handed and turns the rows into the results table. Forwarding is not a progress
// report -- a run's output arrives in one piece when the Studio process exits -- it is what leaves
// the rows of a run that ended early in the terminal, since a partial run writes no file. It is
// the speed tier's counterpart to
// scripts/lune-size-runner.luau, which writes size.md from a Lune run, and the prose of the
// generated file lives here for the same reason it lives there.
//
// Unlike the size table, these numbers describe one machine on one day, so the file records the
// engine, the machine, and the commit of everything it measured. Nothing is written unless the
// suite passed and every row came back in both halves: a partial table would read like a result.
//
// `--only <pattern>...` measures just the fixtures those patterns select (see
// src/bench/selection.ts) and prints the tables instead of writing the file, which is how one
// change is read without spending a full run (`mise run bench:speed:only`). This runs
// `run-in-roblox` itself rather than taking the command as arguments, because a Studio process has
// no argument channel of its own: the patterns can only reach the suite through the script that is
// injected, so a scoped run injects a copy of scripts/run-in-roblox-benchmarks.luau that carries
// them.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { dirname, join } from "node:path";

const ENVIRONMENT_PREFIX = "BENCH_ENV:";
const ROW_PREFIX = "BENCH_ROW:";
const RESULT_PREFIX = "BENCH_RESULT:";

const OUTPUT_PATH = "../docs/benchmarks/speed.md";
const BASELINE = "surge";
/** What a column reads where that library has no entry for the row. */
const EMPTY = "—";

const COMMAND = "run-in-roblox";
const PLACE_PATH = "dist/tests.rbxl";
const ENTRY_PATH = "scripts/run-in-roblox-benchmarks.luau";
/** Where a scoped run's copy of the entry script goes; `npm run build` has just made dist/. */
const SCOPED_ENTRY_PATH = "dist/scoped-benchmarks.luau";
/** The line of the entry script a scoped run rewrites, which that file documents as fixed. */
const FIXTURES_MARKER = "local fixtures = {}";

/**
 * The flag that scopes a run. It is required rather than inferred from "there are arguments", so
 * that `bench:speed:only` with no pattern stops instead of spending a full run and rewriting the
 * results file under a task name that says otherwise.
 */
const SCOPE_FLAG = "--only";

const argv = process.argv.slice(2);
const scoped = argv[0] === SCOPE_FLAG;
const patterns = scoped ? argv.slice(1) : [];

if (scoped && patterns.length === 0) {
	console.error(`${SCOPE_FLAG} needs at least one fixture pattern.`);
	process.exit(2);
}
if (!scoped && argv.length > 0) {
	console.error(`Unexpected argument "${argv[0]}"; a scoped run is \`${SCOPE_FLAG} <pattern>...\`.`);
	process.exit(2);
}

/** `library -> half -> result`, per fixture, in the order the run reported them. */
const fixtures = new Map();
const libraries = [];
const environment = new Map();
let result;

function readRow(line) {
	const [name, library, half, median, lowest, highest] = line.split("|").map((field) => field.trim());
	if (highest === undefined) {
		console.error(`\nMalformed row: ${line}`);
		process.exit(1);
	}

	if (!libraries.includes(library)) libraries.push(library);
	if (!fixtures.has(name)) fixtures.set(name, new Map());
	const halves = fixtures.get(name);
	if (!halves.has(library)) halves.set(library, new Map());
	halves.get(library).set(half, { median: Number(median), lowest: Number(lowest), highest: Number(highest) });
}

let buffered = "";

function forward(chunk, stream) {
	stream.write(chunk);
	buffered += chunk.toString("utf8");
	const lines = buffered.split(/\r?\n/);
	buffered = lines.pop() ?? "";
	for (const line of lines) {
		// Located rather than matched at the start, so a line the harness has prefixed still reads.
		const row = line.indexOf(ROW_PREFIX);
		if (row !== -1) {
			readRow(line.slice(row + ROW_PREFIX.length));
			continue;
		}
		const setting = line.indexOf(ENVIRONMENT_PREFIX);
		if (setting !== -1) {
			const [key, value] = splitOnce(line.slice(setting + ENVIRONMENT_PREFIX.length).trim(), "=");
			environment.set(key, value);
			continue;
		}
		const verdict = line.indexOf(RESULT_PREFIX);
		if (verdict !== -1) result = line.slice(verdict + RESULT_PREFIX.length).trim();
	}
}

function splitOnce(text, separator) {
	const index = text.indexOf(separator);
	return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + separator.length)];
}

/**
 * The script to inject. A scoped run gets a copy of the entry script with its patterns
 * substituted into the one line that file reserves for them.
 */
function entryScript() {
	if (!scoped) {
		return ENTRY_PATH;
	}

	const source = readFileSync(ENTRY_PATH, "utf8");
	if (!source.includes(FIXTURES_MARKER)) {
		console.error(`${ENTRY_PATH} no longer holds the line \`${FIXTURES_MARKER}\`, so a scoped run has no way in.`);
		process.exit(2);
	}

	const list = patterns.map((pattern) => `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(", ");
	mkdirSync(dirname(SCOPED_ENTRY_PATH), { recursive: true });
	writeFileSync(SCOPED_ENTRY_PATH, source.replace(FIXTURES_MARKER, `local fixtures = { ${list} }`), "utf8");
	return SCOPED_ENTRY_PATH;
}

const child = spawn(COMMAND, ["--place", PLACE_PATH, "--script", entryScript()], { shell: false });

child.stdout.on("data", (chunk) => forward(chunk, process.stdout));
child.stderr.on("data", (chunk) => forward(chunk, process.stderr));

child.on("error", (error) => {
	if (error.code === "ENOENT") {
		console.error(
			`${COMMAND} was not found on PATH. Run it through \`mise run bench:speed\` or \`mise run bench:speed:only\`.`,
		);
		process.exit(127);
	}
	console.error(`Failed to run ${COMMAND}: ${error.message}`);
	process.exit(127);
});

child.on("close", (code) => {
	if (code !== 0) {
		console.error(`\n${COMMAND} exited with code ${code}.`);
		process.exit(code ?? 1);
	}
	if (result === undefined) {
		console.error(`\nNo "${RESULT_PREFIX}" line was produced; the benchmark run did not complete.`);
		process.exit(1);
	}
	if (result !== "PASSED") {
		console.error(`\nThe benchmark suite did not pass: ${result}`);
		process.exit(1);
	}
	if (fixtures.size === 0) {
		console.error(`\nThe run passed but reported no rows.`);
		process.exit(1);
	}
	requireBothHalves();
	if (scoped) {
		report();
		return;
	}
	write();
});

/** Both halves of every reported cell, or the file would record a measurement it does not have. */
function requireBothHalves() {
	for (const [name, byLibrary] of fixtures) {
		for (const [library, halves] of byLibrary) {
			for (const half of ["encode", "decode"]) {
				if (!halves.has(half)) {
					console.error(`\n${name} (${library}) reported no ${half} row.`);
					process.exit(1);
				}
			}
		}
	}
}

/** Values per second, at three significant figures, which is more than the spread justifies. */
function formatRate(rate) {
	if (rate >= 1e6) return `${(rate / 1e6).toFixed(2)}M`;
	if (rate >= 1e3) return `${(rate / 1e3).toFixed(1)}k`;
	return rate.toFixed(0);
}

/** A decimal below one percent, so a quiet cell reads as a number rather than as a bound. */
function formatSpread(fraction) {
	return fraction < 0.01 ? `${(fraction * 100).toFixed(1)}%` : `${Math.round(fraction * 100)}%`;
}

function packageVersion(name) {
	return JSON.parse(readFileSync(join("node_modules", name, "package.json"), "utf8")).version;
}

/** The commit a repository is at, marked when its tree carries changes that commit does not. */
function commitOf(repository) {
	const git = (...parameters) => execFileSync("git", ["-C", repository, ...parameters], { encoding: "utf8" }).trim();
	const head = git("rev-parse", "--short", "HEAD");
	return git("status", "--porcelain") === "" ? head : `${head} (uncommitted changes)`;
}

/** The transformer is a sibling checkout, so its path comes from the dependency that names it. */
function transformerPath() {
	const manifest = JSON.parse(readFileSync("package.json", "utf8"));
	return manifest.dependencies["rbxts-transformer-surge"].replace(/^file:/, "");
}

/** Blink and Zap are pinned in mise.toml rather than in a manifest. */
function toolVersion(tool) {
	const [, version] = readFileSync("../mise.toml", "utf8").match(new RegExp(`"github:${tool}" = "([^"]+)"`));
	return version;
}

function runFacts() {
	const [processor] = cpus();
	return [
		["Date", new Date().toISOString().slice(0, 10)],
		["Roblox", environment.get("engine") ?? "unknown"],
		["Machine", `${processor.model.trim()}, ${cpus().length} threads, ${platform()} ${release()}`],
		["surge", commitOf("..")],
		["rbxts-transformer-surge", commitOf(transformerPath())],
		["roblox-ts", packageVersion("roblox-ts")],
		["@rbxts/flamework-binary-serializer", packageVersion("@rbxts/flamework-binary-serializer")],
		["@rbxts/serio", packageVersion("@rbxts/serio")],
		["Blink", toolVersion("1Axen/blink")],
	];
}

function table(half) {
	const header = ["Fixture", ...libraries];
	const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];

	for (const [name, byLibrary] of fixtures) {
		const reference = byLibrary.get(BASELINE)?.get(half);
		if (reference === undefined) {
			console.error(`\n${name} reported no ${BASELINE} ${half} row, so its column has nothing to divide by.`);
			process.exit(1);
		}

		const columns = [name];
		for (const library of libraries) {
			const cell = byLibrary.get(library)?.get(half);
			if (cell === undefined) {
				columns.push(EMPTY);
				continue;
			}
			// Per cell rather than per row: the noise here is concentrated in a few
			// measurements, and a row-wide figure would put their doubt on cells that
			// do not carry it.
			const spread = formatSpread((cell.highest - cell.lowest) / cell.median);
			const ratio = library === BASELINE ? "" : ` (${(cell.median / reference.median).toFixed(2)}×)`;
			columns.push(`${formatRate(cell.median)}${ratio} ±${spread}`);
		}
		lines.push(`| ${columns.join(" | ")} |`);
	}
	return lines;
}

/**
 * What a scoped run leaves behind: the same tables the file would carry, in the same format.
 * They are read against another scoped run of the same patterns, though, and not against
 * speed.md: a scoped run is a run of its own, and the results file says a column is read against
 * the other columns of the same run and never against a number from another file. Nothing is
 * written -- the prose of that file describes the whole catalog, and a speed.md holding a few of
 * its rows would read as a result about all of them.
 */
function report() {
	const counted = `${fixtures.size} ${fixtures.size === 1 ? "fixture" : "fixtures"}`;
	console.log(`\nscoped to ${counted} by ${patterns.join(", ")}; ${OUTPUT_PATH} was not rewritten`);
	console.log(["", "## Encode", "", ...table("encode"), "", "## Decode", "", ...table("decode")].join("\n"));
}

function write() {
	const method = environment.get("method") ?? "unknown";
	const lines = [
		"# Benchmark results: values per second",
		"",
		"Generated by `mise run bench:speed`; do not edit by hand. Tier 2 of the",
		"harness in [future-work/benchmark-tooling.md](../future-work/benchmark-tooling.md).",
		"",
		"Each cell is a throughput in values per second, with its ratio against",
		"surge in the same row: above 1.00× is faster than surge, below it is",
		"slower. Each number is",
		`${method}.`,
		"",
		"The `±` figure is the whole gap between that cell's slowest and fastest",
		"trial, as a fraction of its median. It is not a confidence interval: it",
		"is the raw noise, and a difference narrower than it says nothing.",
		"",
		"**The columns are not compiled alike.** fbs carries `--!native` and",
		"`--!optimize 2` on the two modules its codec runs in, and Blink's",
		"generated module carries both, so both of those codecs are natively",
		"compiled. roblox-ts emits neither. surge's package marks its four hot",
		"modules `//!native`, but the code the transformer generates lives in",
		"each fixture's own module, which does not; serio has neither, and the",
		"baseline drops them on purpose to stay comparable with surge.",
		"`--!native` is worth a large multiple on the kind of loop a codec is",
		"made of, and nothing at all on surge's generated code — both measured,",
		"and both recorded in",
		"[future-work/generated-code-performance.md](../future-work/generated-code-performance.md).",
		"So the fbs and Blink columns are not a like-for-like comparison of codec",
		"design, and nothing here separates how much of their lead is the",
		"directives. The serio and baseline columns are like for like.",
		"",
		"One value is encoded over and over and every result is discarded, so a",
		"number here is throughput for one shape in a warm loop, not an",
		"application profile. [size.md](size.md) says what each row measures and",
		"what it costs in bytes.",
		"",
		"An empty cell means that library has no entry for the row. Zap has no",
		"column at all: it exposes no encoder to call, and the mocked RemoteEvent",
		"its bytes come from exists only under Lune. `baseline` is not a library",
		"either — it is a hand-written codec for three rows, writing surge's",
		"exact bytes, so the distance between the two columns is what surge's",
		"generated code costs over the fewest instructions the shape needs, and",
		"not a difference of format.",
		"",
		"These numbers describe one machine on one day. Read a column against the",
		"other columns of the same run, never against a number from another file.",
		"",
		"The run:",
		"",
		...runFacts().map(([label, value]) => `- ${label}: ${value}`),
		"",
		"## Encode",
		"",
		...table("encode"),
		"",
		"## Decode",
		"",
		...table("decode"),
		"",
	];

	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
	console.log(`\nwrote ${OUTPUT_PATH} (${fixtures.size} fixtures × ${libraries.length} libraries)`);
}
