//!optimize 2
import type { Adapter } from "../adapter";
import loadZapServer from "../zap/deferred";
import type * as ZapServer from "../zap/server";
import decodeZapPacket from "../zap/tooling";

/** Zap writes an event's id as one byte, which the other libraries have no equivalent of. */
const EVENT_ID_BYTES = 1;

/** Zap stores a player's outgoing buffer under the player itself, so any table is a player here. */
const PLAYER = {} as defined;

interface CapturedSend {
	buffer: buffer;
	instances: Array<defined>;
}

/** The mocked remote from scripts/lune-roblox-shim.luau, which records what it is sent. */
interface CapturingRemote extends Instance {
	LastSend?: CapturedSend;
}

function zapRemote(): CapturingRemote {
	const folder = game.GetService("ReplicatedStorage").FindFirstChild("ZAP");
	const remote = folder?.FindFirstChild("ZAP_RELIABLE");
	assert(remote !== undefined, "the Lune shim has not created Zap's remote");
	return remote as CapturingRemote;
}

/**
 * Zap's driver, and the one in this harness that measures rather than asks.
 * Zap has no callable encoder -- its writers target module-global state
 * behind `Fire`/`FireAll`, and only recursive declarations get their own
 * `write_X` -- so a size comes from firing one event at a mocked RemoteEvent
 * and measuring what `SendEvents` flushes, minus the event-id byte. The
 * decode side is the `opt tooling` decoder, which does take a buffer.
 *
 * This works only under the Lune runner, which provides that mocked remote;
 * it is why Zap is a size-only column and the speed tier skips it. See
 * section 4.3 of docs/specs/benchmark-harness.md.
 *
 * The event arrives as a selector rather than as itself, because the module
 * it comes from cannot be required at all in a real Roblox process: nothing
 * here touches Zap until a tier drives the entry, which only the Lune runner
 * does. `defineEntry` defers the rest.
 */
export function zapAdapter<T>(pick: (events: typeof ZapServer) => ZapServer.ZapEvent<T>): Adapter<T> {
	return {
		encode: (value) => {
			const events = loadZapServer();
			pick(events).Fire(PLAYER, value);
			events.SendEvents();

			const send = zapRemote().LastSend;
			assert(send !== undefined, "Zap flushed nothing");
			// Snapshotted here because the next encode overwrites the field.
			// TODO: `send.instances` is always empty here. The shim's `record` keeps a
			// reference to Zap's outgoing instance table, which `SendEvents` clears right
			// after `FireClient`, so `side` reads 0 and `decode` gets no instances. Copy the
			// table in `record` (scripts/lune-roblox-shim.luau) before any Zap row carries
			// an Instance; no row does today, so no recorded result is affected.
			return {
				bytes: buffer.len(send.buffer) - EVENT_ID_BYTES,
				side: send.instances.size(),
				payload: send,
			};
		},
		decode: (payload) => {
			const send = payload as CapturedSend;
			const decoded = decodeZapPacket(zapRemote(), send.buffer, send.instances);
			assert(decoded !== undefined && decoded.size() === 1, "Zap decoded no single event");
			return decoded[0].Arguments[0] as T;
		},
	};
}
