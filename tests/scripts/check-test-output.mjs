// Turns the sentinel line printed by src/index.ts's `main()` into a process exit code.
//
// A failing @Fact is caught internally by runit's TestRunner rather than propagating as an
// uncaught error, so the child process exits 0 whether the suite passed or failed -- the
// pass/fail signal has to come from the piped output. Section 5 of docs/specs/test-harness.md
// states the output contract this participates in.
import { spawn } from "node:child_process";

const SENTINEL = "RUNIT_RESULT:";

const TIMEOUT_VARIABLE = "SURGE_TEST_TIMEOUT";
const DEFAULT_TIMEOUT_SECONDS = 60;

// Extra buffer on top of the configured timeout for process startup (including mise fetching the
// `lune` binary on first use) before the watchdog assumes the run is stuck.
const STARTUP_GRACE_SECONDS = 10;

// `close` waits on every inherited stdio stream, so a child that ignores SIGTERM can hold it open
// forever.
const KILL_GRACE_SECONDS = 10;

function readTimeoutSeconds() {
	const raw = process.env[TIMEOUT_VARIABLE];
	if (raw === undefined || raw.trim() === "") return DEFAULT_TIMEOUT_SECONDS;
	const seconds = Number(raw);
	if (!Number.isInteger(seconds) || seconds <= 0) {
		console.error(`${TIMEOUT_VARIABLE} must be a positive whole number of seconds; got "${raw}".`);
		process.exit(2);
	}
	return seconds;
}

const [command, ...args] = process.argv.slice(2);

if (command === undefined) {
	console.error("usage: check-test-output.mjs <command> [...args]");
	process.exit(2);
}

const timeoutSeconds = readTimeoutSeconds();

const child = spawn(command, args, { shell: false });

const watchdog = setTimeout(
	() => {
		console.error(
			`\n${command} produced no result ${timeoutSeconds + STARTUP_GRACE_SECONDS}s after starting; killing it. ` +
				`Raise ${TIMEOUT_VARIABLE} if the suite legitimately needs longer.`,
		);
		process.exitCode = 1;
		child.kill();
		setTimeout(() => process.exit(1), KILL_GRACE_SECONDS * 1000).unref();
	},
	(timeoutSeconds + STARTUP_GRACE_SECONDS) * 1000,
);

let result;
let buffered = "";

function forward(chunk, stream) {
	stream.write(chunk);
	buffered += chunk.toString("utf8");
	const lines = buffered.split(/\r?\n/);
	buffered = lines.pop() ?? "";
	for (const line of lines) {
		const index = line.indexOf(SENTINEL);
		if (index !== -1) result = line.slice(index + SENTINEL.length).trim();
	}
}

child.stdout.on("data", (chunk) => forward(chunk, process.stdout));
child.stderr.on("data", (chunk) => forward(chunk, process.stderr));

child.on("error", (error) => {
	clearTimeout(watchdog);
	if (error.code === "ENOENT") {
		console.error(`${command} was not found on PATH. Run it through \`mise run tests:test\`.`);
		process.exit(127);
	}
	console.error(`Failed to run ${command}: ${error.message}`);
	process.exit(127);
});

child.on("close", (code) => {
	clearTimeout(watchdog);
	if (process.exitCode === 1) return;
	if (code !== 0) {
		console.error(`\n${command} exited with code ${code}.`);
		process.exit(code ?? 1);
	}
	if (result === undefined) {
		console.error(`\nNo "${SENTINEL}" line was produced; the test run did not complete.`);
		process.exit(1);
	}
	if (result !== "PASSED") {
		console.error(`\nTests did not pass: ${result}`);
		process.exit(1);
	}
	console.log("\nAll tests passed.");
});
