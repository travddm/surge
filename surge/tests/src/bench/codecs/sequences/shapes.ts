/**
 * An array of particle effects, each a `ColorSequence` and a
 * `NumberSequence` of a few keypoints. Each library declares the same types,
 * which carry no width brand. Blink and Zap have no sequence type.
 */
export interface Effect {
	color: ColorSequence;
	size: NumberSequence;
}

export interface Effects {
	effects: Effect[];
}
