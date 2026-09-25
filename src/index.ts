// No //!optimize 2 here, unlike every other module but abi.ts: roblox-ts emits a
// re-export-only module as `local exports = {}` and assignments, above whatever led the first
// statement, so the directive would land after code -- dead, and a Luau lint warning where the
// others are silent. Nothing runs here anyway.
export { DataType } from "./data-type";
export {
	CheckedCodec,
	CheckedDeserializer,
	Codec,
	CodecOptions,
	createCodec,
	createDeserializer,
	createSerializer,
	Deserializer,
	Serialized,
	Serializer,
} from "./serializer";
