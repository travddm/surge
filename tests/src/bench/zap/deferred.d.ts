/**
 * Hand-written declarations for the lazy loader `deferred.luau` next to this
 * file.
 *
 * `server.luau` errors at require time on a client, and Studio's edit mode --
 * where the speed tier runs -- answers true to both `IsClient` and
 * `IsServer`, so requiring it there fails outright. Zap is measured only
 * under Lune, so the loader below is what keeps a fixture that names one of
 * its events loadable in a real Roblox process. The type-only import is
 * erased, so naming the module here does not require it.
 */
import type * as ZapServer from "./server";

declare const loadZapServer: () => typeof ZapServer;

export = loadZapServer;
