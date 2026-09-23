// No //!optimize 2 here, unlike every other module: roblox-ts emits a re-export-only
// module as `local exports = {}` and assignments, above whatever led the first statement,
// so the directive would land after code -- dead, and a Luau lint warning where the others
// are silent. Nothing runs here anyway.
export { finishWrite, grow } from "./alloc";
export { readPackedCFrame, writePackedCFrame } from "./cframe";
export { beginReadBlobs, beginWriteBlobs, finishWriteBlobs, nextBlob, pushBlob } from "./blobs";
export { DataType } from "./data-type";
export { packBit, unpackBit } from "./pack";
export {
	createBinarySerializer,
	createDeserializer,
	createSerializer,
	Serializer,
	SerializerOptions,
} from "./serializer";
