// Runs the speed tier (section 6 of docs/specs/benchmark-harness.md) and writes
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
//
// `--render` writes speed.md again from the trials file, with no run (`mise run
// bench:speed:render`). The trials file carries every trial and every fact of the run it came
// from, so a change to how this file summarizes or lays out a table is read without ten minutes of
// Studio, and the table and the trials cannot drift apart.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { dirname, join } from "node:path";

const ENVIRONMENT_PREFIX = "BENCH_ENV:";
const ROW_PREFIX = "BENCH_ROW:";
const RESULT_PREFIX = "BENCH_RESULT:";

const OUTPUT_PATH = "../docs/benchmarks/speed.md";
/**
 * Every trial behind `OUTPUT_PATH`, one line each, under the facts of the run. That file carries a
 * median and a spread per cell and two drift figures for the whole table, which is what a reader
 * needs; a cell's own drift, or any other statistic over the trials -- whether a median sits
 * nearer its slowest trial than its fastest, say -- is taken from here, and the run's console
 * output is gone by the time anyone asks. Checked in beside the table so that a later run can be
 * compared with this one at trial level and not only at its medians, and so that `--render` can
 * write the table again.
 */
const TRIALS_PATH = "../docs/benchmarks/speed-trials.tsv";
const BASELINE = "surge";
/** What a column reads where that library has no entry for the row. */
const EMPTY = "—";
/** Marks a cell whose spread or drift is above `NOISY`, in the tables and in the prose. */
const FLAG = "†";
/**
 * Spread or drift, as a fraction of the median, above which a cell is marked and left out of the
 * summary. A tenth: below it a cell's noise is smaller than the differences the table exists to
 * show, and above it a ratio through the cell says less than the cell's own doubt.
 */
const NOISY = 0.1;

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
/** The flag that writes the table again from the trials file, with no run. */
const RENDER_FLAG = "--render";

/** The label the trials file carries the suite's method under, so a render can restate it. */
const METHOD_LABEL = "Method";

const argv = process.argv.slice(2);
const scoped = argv[0] === SCOPE_FLAG;
const rendering = argv[0] === RENDER_FLAG;
const patterns = scoped ? argv.slice(1) : [];

if (scoped && patterns.length === 0) {
	console.error(`${SCOPE_FLAG} needs at least one fixture pattern.`);
	process.exit(2);
}
if (rendering && argv.length > 1) {
	console.error(`${RENDER_FLAG} takes no other argument.`);
	process.exit(2);
}
if (!scoped && !rendering && argv.length > 0) {
	console.error(`Unexpected argument "${argv[0]}"; a scoped run is \`${SCOPE_FLAG} <pattern>...\`.`);
	process.exit(2);
}

let runs = scoped ? 1 : RUNS;

/** `fixture -> library -> half -> rates per run`, in the order the first run reported them. */
const fixtures = new Map();
const libraries = [];
const environment = new Map();

/** Which run's rows are being read, from zero. */
let run = 0;
let result;

function addTrials(name, library, half, runIndex, rates) {
	if (!libraries.includes(library)) libraries.push(library);
	if (!fixtures.has(name)) fixtures.set(name, new Map());
	const halves = fixtures.get(name);
	if (!halves.has(library)) halves.set(library, new Map());
	const byHalf = halves.get(library);
	if (!byHalf.has(half)) byHalf.set(half, []);
	byHalf.get(half)[runIndex] = rates;
}

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
	addTrials(name, library, half, run, rates);
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

/**
 * The trials file read back: its facts, in order, and every trial into the same structures a run
 * fills. The method comes from its facts, since a render has no process to ask.
 */
function readTrials() {
	const facts = [];
	let header;
	for (const line of readFileSync(TRIALS_PATH, "utf8").split(/\r?\n/)) {
		if (line === "") continue;
		if (line.startsWith("#")) {
			const [label, value] = splitOnce(line.slice(1).trim(), ": ");
			if (value !== "") facts.push([label, value]);
			continue;
		}
		const fields = line.split("\t");
		if (header === undefined) {
			header = fields;
			continue;
		}
		const [name, library, half, runIndex, trialIndex, rate] = fields;
		const rates = fixtures.get(name)?.get(library)?.get(half)?.[Number(runIndex) - 1] ?? [];
		rates[Number(trialIndex) - 1] = Number(rate);
		addTrials(name, library, half, Number(runIndex) - 1, rates);
		runs = Math.max(runs, Number(runIndex));
	}

	const method = facts.find(([label]) => label === METHOD_LABEL);
	if (method === undefined) {
		console.error(`${TRIALS_PATH} carries no "${METHOD_LABEL}" line, so the table cannot state its method.`);
		process.exit(1);
	}
	environment.set("method", method[1]);
	return facts.filter(([label]) => label !== METHOD_LABEL);
}

if (rendering) {
	const facts = readTrials();
	requireEveryCell();
	write(facts);
} else {
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
		write(runFacts());
	}
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
 * a fraction of the pooled median; it is zero for a single run. A cell is `noisy` when either is
 * above `NOISY`.
 */
function summarize(perRun) {
	const pooled = perRun.flat().sort((left, right) => left - right);
	const median = medianOf(pooled);
	const low = pooled[Math.floor(pooled.length / 4)];
	const high = pooled[Math.floor((pooled.length * 3) / 4)];
	const spread = (high - low) / median;
	const medians = perRun.map((rates) => medianOf([...rates].sort((left, right) => left - right)));
	const drift = (Math.max(...medians) - Math.min(...medians)) / median;
	return { median, spread, drift, noisy: spread > NOISY || drift > NOISY };
}

/** `fixture -> library -> half -> summary`, computed once for the tables, the prose, and the trials. */
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

function formatRatio(ratio) {
	return `${ratio.toFixed(2)}×`;
}

/** Microseconds per value, at three significant figures, from a rate in values per second. */
function formatMicroseconds(rate) {
	const microseconds = 1e6 / rate;
	if (microseconds >= 100) return `${microseconds.toFixed(0)} µs`;
	if (microseconds >= 10) return `${microseconds.toFixed(1)} µs`;
	return `${microseconds.toFixed(2)} µs`;
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

/** The surge cell a row's ratios divide by, or a stop: a row without one has no column to read. */
function referenceOf(name, byLibrary, half) {
	const reference = byLibrary.get(BASELINE)?.get(half);
	if (reference === undefined) {
		console.error(`\n${name} reported no ${BASELINE} ${half} row, so its column has nothing to divide by.`);
		process.exit(1);
	}
	return reference;
}

function markdownTable(header, rows) {
	return [
		`| ${header.join(" | ")} |`,
		`| ${header.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.join(" | ")} |`),
	];
}

/** Every column's throughput, with its spread, marked where the cell is noisy. */
function throughputTable(cells, half) {
	const rows = [];
	for (const [name, byLibrary] of cells) {
		referenceOf(name, byLibrary, half);
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
			columns.push(`${formatRate(cell.median)} ±${formatSpread(cell.spread)}${cell.noisy ? FLAG : ""}`);
		}
		rows.push(columns);
	}
	return markdownTable(["Fixture", ...libraries], rows);
}

/** Every column's time per value: the throughput table again, as microseconds per call. */
function timeTable(cells, half) {
	const rows = [];
	for (const [name, byLibrary] of cells) {
		const columns = [name];
		for (const library of libraries) {
			const cell = byLibrary.get(library)?.get(half);
			columns.push(cell === undefined ? EMPTY : `${formatMicroseconds(cell.median)}${cell.noisy ? FLAG : ""}`);
		}
		rows.push(columns);
	}
	return markdownTable(["Fixture", ...libraries], rows);
}

/** Every other column against surge, marked where either side of the ratio is noisy. */
function ratioTable(cells, half) {
	const others = libraries.filter((library) => library !== BASELINE);
	const rows = [];
	for (const [name, byLibrary] of cells) {
		const reference = referenceOf(name, byLibrary, half);
		const columns = [name];
		for (const library of others) {
			const cell = byLibrary.get(library)?.get(half);
			if (cell === undefined) {
				columns.push(EMPTY);
				continue;
			}
			columns.push(`${formatRatio(cell.median / reference.median)}${cell.noisy || reference.noisy ? FLAG : ""}`);
		}
		rows.push(columns);
	}
	return markdownTable(["Fixture", ...others], rows);
}

/**
 * One figure per library and half: the geometric mean of its ratios against surge over the rows
 * both have a cell in and neither cell is noisy. Geometric, because ratios multiply: a column
 * twice as fast on one row and half as fast on another means 1.00×, not 1.25×. The count says how
 * many rows the figure stands on.
 */
function summaryTable(cells) {
	const others = libraries.filter((library) => library !== BASELINE);
	const rows = [];
	for (const library of others) {
		const columns = [library];
		for (const half of ["encode", "decode"]) {
			const logs = [];
			let shared = 0;
			for (const [name, byLibrary] of cells) {
				const cell = byLibrary.get(library)?.get(half);
				if (cell === undefined) continue;
				shared += 1;
				const reference = referenceOf(name, byLibrary, half);
				if (cell.noisy || reference.noisy) continue;
				logs.push(Math.log(cell.median / reference.median));
			}
			if (logs.length === 0) {
				columns.push(EMPTY);
				continue;
			}
			const mean = Math.exp(logs.reduce((sum, value) => sum + value, 0) / logs.length);
			columns.push(`${formatRatio(mean)} over ${logs.length} of ${shared} rows`);
		}
		rows.push(columns);
	}
	return markdownTable(["Library", "Encode", "Decode"], rows);
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

function halfSection(cells, half) {
	const title = half === "encode" ? "Encode" : "Decode";
	return [
		`## ${title} throughput`,
		"",
		...throughputTable(cells, half),
		"",
		`## ${title} time per value`,
		"",
		...timeTable(cells, half),
		"",
		`## ${title} against surge`,
		"",
		...ratioTable(cells, half),
	];
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
	console.log(["", ...halfSection(cells, "encode"), "", ...halfSection(cells, "decode")].join("\n"));
}

/**
 * Every trial of every run, one line each, tab-separated because it is read by whatever is at
 * hand rather than by a person. It repeats the table's provenance lines, and the suite's method,
 * so that a pair of files measured together can be told from a pair that was not and so that
 * `--render` can write the table again.
 */
function writeTrials(facts) {
	const lines = [
		"# Trials behind speed.md. Written by `mise run bench:speed`; do not edit by hand.",
		...facts.map(([label, value]) => `# ${label}: ${value}`),
		`# ${METHOD_LABEL}: ${environment.get("method") ?? "unknown"}`,
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

function write(facts) {
	const cells = summaries();
	const drift = driftFacts(cells);
	const lines = [
		"# Benchmark results: values per second",
		"",
		"Generated by `mise run bench:speed`; do not edit by hand.",
		"",
		...summaryTable(cells),
		"",
		"Each figure is the geometric mean of that library's throughput against",
		"surge's over the rows both have: above 1.00× is faster than surge.",
		"",
		...wrap(
			`Each cell below is a median throughput over ${runs === 1 ? "one run" : `${runs} runs back to back`}. \`±\` is the middle half of its trials, as a fraction of the median.${runs === 1 ? "" : ` Between the runs, no cell moved by more than ${formatSpread(drift.largest)} and nine in ten by under ${formatSpread(drift.ninthDecile)}; a difference narrower than that is noise.`} A cell marked ${FLAG} spread or moved by more than ${formatSpread(NOISY)} and is left out of the summary.`,
		),
		"",
		"Time per value is the same measurement as microseconds per call, which",
		"reads across rows where a rate does not.",
		"",
		"`baseline` is a hand-written codec that writes surge's exact bytes on",
		"three rows, so its ratio is what surge's generated code costs against",
		"hand-written Luau. `surge (readChecks)` is surge with `readChecks` on,",
		"as a server reading what clients send would use it: its decode ratio is",
		"what the checks cost, and its encode runs the same code as surge's. Zap",
		"exposes no encoder to call and has no column.",
		"Every column but serio runs with `--!native` and `--!optimize 2`.",
		"",
		"Each number is one shape in a warm loop, on one machine on one day, not",
		"an application profile; compare columns within this file only.",
		"[size.md](size.md) gives each row's bytes, and",
		"[specs/benchmark-harness.md](../specs/benchmark-harness.md) says how the suite measures.",
		"",
		"The run:",
		"",
		...facts.map(([label, value]) => `- ${label}: ${value}`),
		"",
		...halfSection(cells, "encode"),
		"",
		...halfSection(cells, "decode"),
		"",
	];

	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
	console.log(`\nwrote ${OUTPUT_PATH} (${cells.size} fixtures × ${libraries.length} libraries)`);
	if (!rendering) writeTrials(facts);
}
