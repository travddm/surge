//!native
// Native code generation; it buys nothing by itself. See Native code generation in
// docs/future-work/generated-code-performance.md.
// The `CFrame` encoding inside a `DataType.Packed<T>` subtree (Type Coverage
// -> Packed<T> in transformer.md). One header byte, then only the parts the
// header does not already give:
//
//   bits 0-4: the rotation. 0-23 is an axis-aligned rotation, 31 is any other
//             rotation, followed by 3 x f32 (axis * angle, as outside Packed).
//   bits 5-6: the position. 0 is any position, followed by 3 x f32. 1 is
//             Vector3.zero and 3 is Vector3.one, with no bytes.
//
// 1 byte for an axis-aligned rotation at the origin, 13 for one elsewhere, and
// 25 for a CFrame with neither property, which is 1 more than outside Packed.
//
// Unlike every other encoding, this one branches on the value, so it is a
// runtime function and not inlined code: the branches are the encoding.
import { alloc, readAlloc } from "./alloc";

const GENERAL_ROTATION = 31;
const POSITION_ZERO = 1;
const POSITION_ONE = 3;

// A CFrame stores f32 components, so `CFrame.Angles(math.pi / 2, 0, 0)` has a
// component of -4.4e-8 where the exact rotation has 0. The tolerance is about
// 20 times that drift. Snapping moves a rotation by at most 1e-6, which is
// about 5 times the error of the f32 axis-angle form and far below a
// deliberate offset.
const ALIGNED_TOLERANCE = 1e-6;

/**
 * `axis * 2 + (negative ? 1 : 0)` for a unit vector along a coordinate axis,
 * or -1. All three components are checked: a vector with one component above
 * `1 - tolerance` can still have another of about `sqrt(2 * tolerance)`.
 */
function axisCode(unit: Vector3): number {
	const x = math.abs(unit.X);
	const y = math.abs(unit.Y);
	const z = math.abs(unit.Z);
	if (y <= ALIGNED_TOLERANCE && z <= ALIGNED_TOLERANCE && x > 0.5) {
		return unit.X > 0 ? 0 : 1;
	}
	if (x <= ALIGNED_TOLERANCE && z <= ALIGNED_TOLERANCE && y > 0.5) {
		return unit.Y > 0 ? 2 : 3;
	}
	if (x <= ALIGNED_TOLERANCE && y <= ALIGNED_TOLERANCE && z > 0.5) {
		return unit.Z > 0 ? 4 : 5;
	}
	return -1;
}

const AXES = [Vector3.xAxis, Vector3.yAxis, Vector3.zAxis];

function axisFromCode(code: number): Vector3 {
	const axis = AXES[code.idiv(2)];
	return code % 2 === 0 ? axis : axis.mul(-1);
}

/**
 * 0-23 for an axis-aligned rotation, otherwise `GENERAL_ROTATION`. The X
 * vector has 6 directions, and the Y vector one of the 4 directions that are
 * not on the X vector's axis; the Z vector follows from the other two.
 */
function rotationIndex(value: CFrame): number {
	const xCode = axisCode(value.XVector);
	const yCode = axisCode(value.YVector);
	if (xCode === -1 || yCode === -1) {
		return GENERAL_ROTATION;
	}
	const firstCodeOnXAxis = xCode.idiv(2) * 2;
	return xCode * 4 + (yCode < firstCodeOnXAxis ? yCode : yCode - 2);
}

const ALIGNED_ROTATIONS = new Array<CFrame>();
for (const index of $range(0, 23)) {
	const xCode = index.idiv(4);
	const rank = index % 4;
	const firstCodeOnXAxis = xCode.idiv(2) * 2;
	const x = axisFromCode(xCode);
	const y = axisFromCode(rank < firstCodeOnXAxis ? rank : rank + 2);
	ALIGNED_ROTATIONS.push(CFrame.fromMatrix(Vector3.zero, x, y, x.Cross(y)));
}

/** Writes a `CFrame` in the packed form described at the top of this file. */
export function writePackedCFrame(value: CFrame): void {
	const position = value.Position;
	let positionCode = 0;
	if (position === Vector3.zero) {
		positionCode = POSITION_ZERO;
	} else if (position === Vector3.one) {
		positionCode = POSITION_ONE;
	}
	const rotation = rotationIndex(value);
	const [headerBuf, headerPos] = alloc(1);
	buffer.writeu8(headerBuf, headerPos, rotation + positionCode * 32);
	if (positionCode === 0) {
		const [buf, pos] = alloc(12);
		buffer.writef32(buf, pos, position.X);
		buffer.writef32(buf, pos + 4, position.Y);
		buffer.writef32(buf, pos + 8, position.Z);
	}
	if (rotation === GENERAL_ROTATION) {
		const [axis, angle] = value.ToAxisAngle();
		const scaled = axis.mul(angle);
		const [buf, pos] = alloc(12);
		buffer.writef32(buf, pos, scaled.X);
		buffer.writef32(buf, pos + 4, scaled.Y);
		buffer.writef32(buf, pos + 8, scaled.Z);
	}
}

/** Reads what {@link writePackedCFrame} wrote. */
export function readPackedCFrame(): CFrame {
	const [headerBuf, headerPos] = readAlloc(1);
	const header = buffer.readu8(headerBuf, headerPos);
	const rotationCode = header % 32;
	const positionCode = header.idiv(32);
	let position = Vector3.zero;
	if (positionCode === POSITION_ONE) {
		position = Vector3.one;
	} else if (positionCode === 0) {
		const [buf, pos] = readAlloc(12);
		position = new Vector3(buffer.readf32(buf, pos), buffer.readf32(buf, pos + 4), buffer.readf32(buf, pos + 8));
	}
	if (rotationCode !== GENERAL_ROTATION) {
		return ALIGNED_ROTATIONS[rotationCode].add(position);
	}
	const [buf, pos] = readAlloc(12);
	const scaled = new Vector3(buffer.readf32(buf, pos), buffer.readf32(buf, pos + 4), buffer.readf32(buf, pos + 8));
	const angle = scaled.Magnitude;
	// The same rule as the byte-aligned form: no axis to recover from a zero rotation.
	return CFrame.fromAxisAngle(angle > 1e-6 ? scaled.Unit : Vector3.zAxis, angle).add(position);
}
