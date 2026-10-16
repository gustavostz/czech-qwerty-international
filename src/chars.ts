/** Character helpers shared by the generators. */

/** The UTF-16 code unit of a character; layout files hold one code unit per key. */
export function codeUnit(char: string): number {
  if (char.length !== 1) throw new Error(`"${char}" is not a single UTF-16 code unit`);
  return char.charCodeAt(0);
}

/** Four lowercase hex digits, the way layout files write code points. */
export const hex4 = (value: number): string => value.toString(16).padStart(4, "0");

/** ASCII letters and digits, which layout files write as themselves. */
export const isAlphanumeric = (char: string): boolean => /^[0-9A-Za-z]$/.test(char);
