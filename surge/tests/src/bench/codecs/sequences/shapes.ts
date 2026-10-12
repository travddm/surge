/**
 * An array of particle effects, each a `ColorSequence` and a
 * `NumberSequence` of a few keypoints. Each library declares the same types,
 * which carry no width brand. Blink and Zap have no sequence type. serio
 * stores a keypoint's time, and a `NumberSequence` keypoint's value and
 * envelope, as a `u16` over 0 to 1, so its round trip is inexact by design.
 */
export interface Effect {
	color: ColorSequence;
	size: NumberSequence;
}

export interface Effects {
	effects: Effect[];
}
