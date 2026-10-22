/**
 * `Enum.Material` has 45 members, so each item is a u8 index in all three
 * libraries -- surge indexes the members sorted by name, fbs and serio by
 * `.Value`, which is the same width. The wide (u16) index that an enum of
 * more than 256 members takes cannot be measured here: the generated lookup
 * tables name every member `@rbxts/types` declares, and Lune's Roblox
 * database is missing members of every such enum -- `KeyCode` included,
 * which is why `coverage.spec.ts` skips it too.
 *
 * No width brands, so the three libraries share one shape.
 */
export interface EnumHeavy {
	materials: Enum.Material[];
	primary: Enum.Material;
	rig: Enum.HumanoidRigType;
}
