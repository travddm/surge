// Runs the speed tier (Tier 2 of docs/future-work/benchmark-tooling.md) and writes
// ../docs/benchmarks/speed.md from what it printed, via `mise run bench:speed`.
//
// A Roblox process cannot write a file, so src/bench/speed.spec.ts prints one `BENCH_ROW:` line
// per fixture, library, and half, carrying every trial's rate, and src/index.ts closes with
// `BENCH_RESULT:`. This forwards every line it is handed and turns the rows into the results
// table. The rows arrive as they are measured, because the suite yields between its timed chunks
// and the run-in-roblox plugin flushes what was printed on every Heartbeat; forwarding them is
// also what leaves the rows of a run that ended early in the terminal, since a partial run writes
// no file. It is the speed tier's counterpart to scripts/lune-size-runner.luau, which writes
// size.md from a Lune run, and the prose of the generated file lives here for the same reason it
// lives there.
//
// A full run is `RUNS` Studio processes back to back, and a cell is summarized over the trials of
// all of them. The `±` a cell carries is spread within a run; what a reader needs to tell a real
// change from noise between runs is how far a cell moves between two runs at the same commit, and
// only two runs can say that. The file records that drift, and the trials file beside it keeps
// every trial of every run so that a later run can be compared at trial level.
//
// The suite prints rates and this file summarizes them, so the statistic is defined in one place:
// here. Unlike the size table, these numbers describe one machine on one day, so the file records
// the engine, the machine, and the commit of everything it measured. Nothing is written unless
// every run passed and every row came back in both halves of every run: a partial table would
// read like a result.
//
// `--only <pattern>...` measures just the fixtures those patterns select (see
// src/bench/selection.ts), in one run, and prints the tables instead of writing the file, which
// is how one change is read without spending a full run (`mise run bench:speed:only`). This runs
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
/**
 * Every trial behind `OUTPUT_PATH`, one line each. That file carries a median and a spread per
 * cell and two drift figures for the whole table, which is what a reader needs; a cell's own
 * drift, or any other statistic over the trials -- whether a median sits nearer its slowest trial
 * than its fastest, say -- cannot be taken from it, and the run's console output is gone by the
 * time anyone asks. Checked in beside the table so that a later run can be compared with this one
 * at trial level and not only at its medians.
 */
const TRIALS_PATH = "../docs/benchmarks/speed-trials.tsv";
const BASELINE = "surge";
/** What a column reads where that library has no entry for the row. */
const EMPTY = "—";

/** Studio processes a full run spends, back to back; the drift a cell shows is between them. */
const RUNS = 2;

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

const runs = scoped ? 1 : RUNS;

/** `fixture -> library -> half -> rates per run`, in the order the first run reported them. */
const fixtures = new Map();
const libraries = [];
const environment = new Map();

/** Which run's rows are being read, from zero. */
let run = 0;
let result;

function readRow(line) {
	const [name, library, half, trials] = line.split("|").map((field) => field.trim());
	if (trials === undefined) {
		console.error(`\nMalformed row: ${line}`);
		process.exit(1);
	}
	const rates = trials.split(/\s+/).map(Number);
	if (rates.length === 0 || rates.some((rate) => !Number.isFinite(rate))) {
		console.error(`\nMalformed trials: ${line}`);
		process.exit(1);
	}

	if (!libraries.includes(library)) libraries.push(library);
	if (!fixtures.has(name)) fixtures.set(name, new Map());
	const halves = fixtures.get(name);
	if (!halves.has(library)) halves.set(library, new Map());
	const byHalf = halves.get(library);
	if (!byHalf.has(half)) byHalf.set(half, []);
	byHalf.get(half)[run] = rates;
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

/** One Studio process; resolves once it has exited and its output has been read. */
function runOnce(script) {
	return new Promise((resolve) => {
		result = undefined;
		buffered = "";
		const child = spawn(COMMAND, ["--place", PLACE_PATH, "--script", script], { shell: false });

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
			resolve();
		});
	});
}

const script = entryScript();
for (run = 0; run < runs; run += 1) {
	if (runs > 1) console.log(`\nrun ${run + 1} of ${runs}`);
	await runOnce(script);
}

if (fixtures.size === 0) {
	console.error(`\nThe run passed but reported no rows.`);
	process.exit(1);
}
requireEveryCell();
if (scoped) {
	report();
} else {
	write();
}

/**
 * Both halves of every reported cell, in every run, or the file would record a measurement it
 * does not have.
 */
function requireEveryCell() {
	for (const [name, byLibrary] of fixtures) {
		for (const [library, halves] of byLibrary) {
			for (const half of ["encode", "decode"]) {
				const perRun = halves.get(half);
				for (let index = 0; index < runs; index += 1) {
					if (perRun?.[index] === undefined) {
						console.error(`\n${name} (${library}) reported no ${half} row in run ${index + 1}.`);
						process.exit(1);
					}
				}
			}
		}
	}
}

/** The middle of a sorted list, or the mean of its two middles. */
function medianOf(sorted) {
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * One cell's statistics over every run's trials. `low` and `high` are the trials a quarter of the
 * way in from either end of the sorted list, so the spread between them is the middle half of the
 * trials and one stray trial cannot set it. `drift` is how far the runs' own medians sit apart, as
 * a fraction of the pooled median; it is zero for a single run.
 */
function summarize(perRun) {
	const pooled = perRun.flat().sort((left, right) => left - right);
	const median = medianOf(pooled);
	const low = pooled[Math.floor(pooled.length / 4)];
	const high = pooled[Math.floor((pooled.length * 3) / 4)];
	const medians = perRun.map((rates) => medianOf([...rates].sort((left, right) => left - right)));
	const drift = (Math.max(...medians) - Math.min(...medians)) / median;
	return { median, low, high, drift };
}

/** `fixture -> library -> half -> summary`, computed once for the table, the prose, and the trials. */
function summaries() {
	const cells = new Map();
	for (const [name, byLibrary] of fixtures) {
		const perLibrary = new Map();
		for (const [library, halves] of byLibrary) {
			const perHalf = new Map();
			for (const [half, perRun] of halves) perHalf.set(half, summarize(perRun));
			perLibrary.set(library, perHalf);
		}
		cells.set(name, perLibrary);
	}
	return cells;
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
		["Runs", `${runs}, back to back`],
		["surge", commitOf("..")],
		["rbxts-transformer-surge", commitOf(transformerPath())],
		["roblox-ts", packageVersion("roblox-ts")],
		["@rbxts/flamework-binary-serializer", packageVersion("@rbxts/flamework-binary-serializer")],
		["@rbxts/serio", packageVersion("@rbxts/serio")],
		["Blink", toolVersion("1Axen/blink")],
	];
}

function table(cells, half) {
	const header = ["Fixture", ...libraries];
	const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];

	for (const [name, byLibrary] of cells) {
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
			const spread = formatSpread((cell.high - cell.low) / cell.median);
			const ratio = library === BASELINE ? "" : ` (${(cell.median / reference.median).toFixed(2)}×)`;
			columns.push(`${formatRate(cell.median)}${ratio} ±${spread}`);
		}
		lines.push(`| ${columns.join(" | ")} |`);
	}
	return lines;
}

/**
 * How far cells moved between runs: the largest drift any cell showed, and the drift nine cells in
 * ten stayed under. A difference between two files narrower than these is not a result.
 */
function driftFacts(cells) {
	const drifts = [];
	for (const byLibrary of cells.values()) {
		for (const perHalf of byLibrary.values()) {
			for (const cell of perHalf.values()) drifts.push(cell.drift);
		}
	}
	drifts.sort((left, right) => left - right);
	return { largest: drifts[drifts.length - 1], ninthDecile: drifts[Math.floor(drifts.length * 0.9)] };
}

/**
 * The sentences of the generated file are written out by hand at this width, and this folds the
 * sentences that carry a value from the run to the same width, so that the file passes the
 * repository's line-length rule whatever the suite says about its method.
 */
function wrap(sentence, width = 72) {
	const lines = [];
	let line = "";
	for (const word of sentence.split(" ")) {
		if (line !== "" && line.length + 1 + word.length > width) {
			lines.push(line);
			line = word;
			continue;
		}
		line = line === "" ? word : `${line} ${word}`;
	}
	lines.push(line);
	return lines;
}

/**
 * What a scoped run leaves behind: the same tables the file would carry, in the same format, from
 * one run. They are read against another scoped run of the same patterns, though, and not against
 * speed.md: a scoped run is a run of its own, and the results file says a column is read against
 * the other columns of the same run and never against a number from another file. Nothing is
 * written -- the prose of that file describes the whole catalog, and a speed.md holding a few of
 * its rows would read as a result about all of them.
 */
function report() {
	const cells = summaries();
	const counted = `${cells.size} ${cells.size === 1 ? "fixture" : "fixtures"}`;
	console.log(`\nscoped to ${counted} by ${patterns.join(", ")}, in one run; ${OUTPUT_PATH} was not rewritten`);
	console.log(
		["", "## Encode", "", ...table(cells, "encode"), "", "## Decode", "", ...table(cells, "decode")].join("\n"),
	);
}

/**
 * Every trial of every run, one line each, tab-separated because it is read by whatever is at
 * hand rather than by a person. It repeats the table's provenance lines so that a pair of files
 * measured together can be told from a pair that was not.
 */
function writeTrials(facts) {
	const lines = [
		"# Trials behind speed.md. Written by `mise run bench:speed`; do not edit by hand.",
		...facts.map(([label, value]) => `# ${label}: ${value}`),
		["fixture", "library", "half", "run", "trial", "rate"].join("\t"),
	];
	let count = 0;
	for (const [name, byLibrary] of fixtures) {
		for (const [library, halves] of byLibrary) {
			for (const [half, perRun] of halves) {
				perRun.forEach((rates, runIndex) => {
					rates.forEach((rate, trialIndex) => {
						lines.push([name, library, half, runIndex + 1, trialIndex + 1, rate].join("\t"));
						count += 1;
					});
				});
			}
		}
	}

	mkdirSync(dirname(TRIALS_PATH), { recursive: true });
	writeFileSync(TRIALS_PATH, `${lines.join("\n")}\n`, "utf8");
	console.log(`wrote ${TRIALS_PATH} (${count} trials)`);
}

function write() {
	const cells = summaries();
	const method = environment.get("method") ?? "unknown";
	const drift = driftFacts(cells);
	// Once, so that the table and the trials beside it cannot disagree about the run they record.
	const facts = runFacts();
	const lines = [
		"# Benchmark results: values per second",
		"",
		"Generated by `mise run bench:speed`; do not edit by hand.",
		"",
		"Each cell is a throughput in values per second, with its ratio against",
		"surge in the same row: above 1.00× is faster than surge, below it is",
		"slower.",
		...wrap(
			`Each cell is the median over the trials of ${runs} runs of the suite, back to back, each run being ${method}.`,
		),
		"",
		"The `±` figure is the gap between the trials a quarter of the way in",
		"from either end of that cell's sorted trials, as a fraction of its",
		"median: the middle half of the trials, which one stray trial cannot",
		"set. It is not a confidence interval: it is the raw noise within a run,",
		"and a difference narrower than it says nothing.",
		"",
		...wrap(
			`Between the runs behind this file, no cell's median moved by more than ${formatSpread(drift.largest)}, and nine cells in ten moved by under ${formatSpread(drift.ninthDecile)}. That is the run-to-run noise on this machine on this day: a difference between two files narrower than it is not a result either.`,
		),
		"",
		"Within a row the libraries take turns, one trial each, so a drift over",
		"the row lands on every column alike, and a ratio between two columns of",
		"the same row is read against the same conditions.",
		"",
		"The columns do not all carry Luau's compiler directives. The modules",
		"holding surge's generated serializers carry `--!native` and",
		"`--!optimize 2`, and so does the hand-written baseline; fbs and Blink",
		"carry both as they ship, on the modules their codecs run in. serio",
		"carries neither, so its column is a comparison of compilation mode as",
		"well as of codec design.",
		"",
		"One value is encoded, or one buffer decoded, over and over, and every",
		"result is discarded, so a number here is throughput for one shape in a",
		"warm loop, not an application profile. [size.md](size.md) says what each",
		"row measures and what it costs in bytes.",
		"",
		"An empty cell means that library has no entry for the row. Zap has no",
		"column at all, because it exposes no encoder to call. `baseline` is not",
		"a library either: it is a hand-written codec over three rows that writes",
		"surge's exact bytes, so the distance between those two columns is what",
		"surge's generated code costs over the fewest instructions the shape",
		"needs, and not a difference of format.",
		"",
		"These numbers describe one machine on one day. Read a column against the",
		"other columns of the same run, never against a number from another file.",
		"",
		"The run:",
		"",
		...facts.map(([label, value]) => `- ${label}: ${value}`),
		"",
		"## Encode",
		"",
		...table(cells, "encode"),
		"",
		"## Decode",
		"",
		...table(cells, "decode"),
		"",
	];

	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
	console.log(`\nwrote ${OUTPUT_PATH} (${cells.size} fixtures × ${libraries.length} libraries)`);
	writeTrials(facts);
}
