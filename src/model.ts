/**
 * Platform-neutral description of a keyboard layout. Every platform file
 * (Windows DLL/KLC, Linux XKB, macOS keylayout) and the diagrams are
 * generated from a `Layout`.
 */
import type { KeyId } from "./keys";

export type Accent = "acute" | "diaeresis" | "grave" | "tilde" | "circumflex";

/** A key that starts a dead-key sequence instead of typing a character. */
export interface Dead {
  dead: Accent;
}

/** What a key types in one shift state: a character, a dead key, or nothing. */
export type Cell = string | Dead | null;

export const LEVELS = ["base", "shift", "altgr", "shiftAltgr"] as const;
export type Level = (typeof LEVELS)[number];

export type KeyLevels = Record<Level, Cell>;

export interface DeadKey {
  /**
   * The spacing character that identifies this dead key. It is typed when
   * the dead key is followed by Space, or by a key it does not combine with.
   */
  char: string;
  /** Name shown by Windows for the dead key. */
  name: string;
  /** Base character → composed character. */
  compose: Record<string, string>;
}

export interface Layout {
  /** Short id used in file names. */
  id: string;
  /** Display name. */
  name: string;
  /** XKB variant name. */
  variant: string;
  /** Windows DLL name without extension (8.3 compatible). */
  dll: string;
  /** macOS keyboard id; custom layouts use negative ids. */
  macId: number;
  /** One-line summary, shown in the diagrams and generated files. */
  summary: string;
  keys: Record<KeyId, KeyLevels>;
  deadKeys: Partial<Record<Accent, DeadKey>>;
}

export const dead = (accent: Accent): Dead => ({ dead: accent });

export const isDead = (cell: Cell): cell is Dead => typeof cell === "object" && cell !== null;

/** Shorthand for a key's four levels; omitted levels type nothing. */
export function key(base: Cell, shift: Cell, altgr: Cell = null, shiftAltgr: Cell = null): KeyLevels {
  return { base, shift, altgr, shiftAltgr };
}

/** True when `upper` is the uppercase form of `lower` (so Caps Lock should swap them). */
export function isCasePair(lower: Cell, upper: Cell): boolean {
  if (typeof lower !== "string" || typeof upper !== "string" || lower === upper) return false;
  return lower.toUpperCase() === upper && upper.toLowerCase() === lower;
}

/** How Caps Lock affects a key, derived from its characters. */
export function capsLock(levels: KeyLevels): { base: boolean; altgr: boolean } {
  return {
    base: isCasePair(levels.base, levels.shift),
    altgr: isCasePair(levels.altgr, levels.shiftAltgr),
  };
}

/** The character a dead key types on its own. */
export function deadChar(layout: Layout, accent: Accent): string {
  const deadKey = layout.deadKeys[accent];
  if (!deadKey) throw new Error(`${layout.id}: dead key "${accent}" is used but not defined`);
  return deadKey.char;
}

/** Dead keys with their accents, in definition order. */
export function deadKeyList(deadKeys: Layout["deadKeys"]): [Accent, DeadKey][] {
  return Object.entries(deadKeys) as [Accent, DeadKey][];
}

/** Everything a dead key types: its compositions, and its own character when followed by Space. */
export function deadKeyEntries(deadKey: DeadKey): [base: string, composed: string][] {
  return [...Object.entries(deadKey.compose), [" ", deadKey.char]];
}

/** Every character a layout can type directly or through a dead key. */
export function typeableChars(layout: Layout): Set<string> {
  const chars = new Set<string>();
  for (const levels of Object.values(layout.keys)) {
    for (const level of LEVELS) {
      const cell = levels[level];
      if (typeof cell === "string") chars.add(cell);
    }
  }
  for (const deadKey of Object.values(layout.deadKeys)) {
    for (const [, composed] of deadKeyEntries(deadKey)) chars.add(composed);
  }
  return chars;
}
