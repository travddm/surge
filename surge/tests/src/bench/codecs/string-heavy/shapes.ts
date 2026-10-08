/**
 * No width brands anywhere, so the three libraries declare the same shape:
 * a plain `string` is a u32 length prefix plus its bytes in all of them.
 */
export interface StringHeavy {
	title: string;
	author: string;
	lines: string[];
}
