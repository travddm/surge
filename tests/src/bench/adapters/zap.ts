import type { Adapter } from "../adapter";
import type { ZapEvent } from "../zap/server";
import { SendEvents } from "../zap/server";
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
 * it is why Zap is a size-only column and `speed.spec.ts` skips it. See
 * docs/future-work/benchmark-tooling.md.
 */
export function zapAdapter<T>(event: ZapEvent<T>): Adapter<T> {
	const remote = zapRemote();
	return {
		encode: (value) => {
			event.Fire(PLAYER, value);
			SendEvents();

			const send = remote.LastSend;
			assert(send !== undefined, "Zap flushed nothing");
			// Snapshotted here because the next encode overwrites the field.
			return {
				bytes: buffer.len(send.buffer) - EVENT_ID_BYTES,
				side: send.instances.size(),
				payload: send,
			};
		},
		decode: (payload) => {
			const send = payload as CapturedSend;
			const decoded = decodeZapPacket(remote, send.buffer, send.instances);
			assert(decoded !== undefined && decoded.size() === 1, "Zap decoded no single event");
			return decoded[0].Arguments[0] as T;
		},
	};
}
