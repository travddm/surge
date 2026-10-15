//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface EnumHeavy {
	materials: Enum.Material[];
	primary: Enum.Material;
	rig: Enum.HumanoidRigType;
}

export const flamework2Serializer = Flamework.createSerializer<EnumHeavy>();
