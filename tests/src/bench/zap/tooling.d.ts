/**
 * Hand-written declarations for the Zap tooling decoder `tooling.luau` next to
 * this file, which `mise run bench:definitions` generates from
 * ../definitions/catalog.zap (`opt tooling`).
 *
 * The module is one function. It takes the remote the traffic was seen on,
 * then either `(player, buffer, instances)` for a client-to-server packet or
 * `(buffer, instances)` for a server-to-client one -- it tells the two apart
 * by whether its second argument is a buffer. Every event in the catalog is
 * `from: Server`, so only the second form is declared here. It returns one
 * entry per event in the packet, or nothing when the remote is not Zap's.
 */
export interface ZapDecodedEvent {
	Name: string;
	Arguments: Array<unknown>;
}

declare const decodeZapPacket: (
	remote: Instance,
	buf: buffer,
	instances: Array<defined>,
) => Array<ZapDecodedEvent> | undefined;

export = decodeZapPacket;
