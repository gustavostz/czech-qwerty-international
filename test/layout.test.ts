import { describe, expect, test } from "bun:test";
import { KEY_IDS, type KeyId } from "../src/keys";
import { CZECH_LETTERS, CZECH_QWERTY_INTERNATIONAL, CZECH_QWERTY_INTERNATIONAL_PROGRAMMER, LAYOUTS } from "../src/layout";
import { US_INTERNATIONAL_DEAD_KEYS, US_INTERNATIONAL_KEYS } from "../src/layout/us-international";
import { LEVELS, type Layout, capsLock, isDead, typeableChars } from "../src/model";

const US_INTERNATIONAL: Layout = {
  ...CZECH_QWERTY_INTERNATIONAL,
  keys: US_INTERNATIONAL_KEYS,
  deadKeys: US_INTERNATIONAL_DEAD_KEYS,
};

const CZECH_ALPHABET = "áčďéěíňóřšťúůýž";

describe.each(LAYOUTS.map((layout) => [layout.name, layout] as const))("%s", (_, layout) => {
  test("AltGr + a letter types that letter with a háček or ring; Shift makes it a capital", () => {
    for (const [id, [lower, upper]] of Object.entries(CZECH_LETTERS) as [KeyId, [string, string]][]) {
      const levels = layout.keys[id];
      expect([levels.altgr, levels.shiftAltgr]).toEqual([lower, upper]);
      expect(lower.normalize("NFD")[0]).toBe(levels.base as string); // č = c + ˇ
      expect(capsLock(levels).altgr).toBe(true);
    }
  });

  test("the acute dead key types á é í ó ú ý and their capitals", () => {
    const acute = layout.deadKeys.acute!.compose;
    for (const vowel of "aeiouy") {
      const accented = `${vowel}́`.normalize("NFC");
      expect(acute[vowel]).toBe(accented);
      expect(acute[vowel.toUpperCase()]).toBe(accented.toUpperCase());
    }
  });

  test("' then d, t, s, m, l, r or v is just an apostrophe, so English contractions stay intact", () => {
    for (const letter of "dtsmlrv") expect(layout.deadKeys.acute!.compose[letter]).toBeUndefined();
  });

  test("types the whole Czech alphabet", () => {
    const chars = typeableChars(layout);
    const missing = [...CZECH_ALPHABET + CZECH_ALPHABET.toUpperCase()].filter((c) => !chars.has(c));
    expect(missing).toEqual([]);
  });

  test("types every character US-International can", () => {
    const chars = typeableChars(layout);
    expect([...typeableChars(US_INTERNATIONAL)].filter((c) => !chars.has(c))).toEqual([]);
  });

  test("every dead key it uses is defined, and every defined dead key is on a key", () => {
    const used = new Set<string>();
    for (const id of KEY_IDS) {
      for (const level of LEVELS) {
        const cell = layout.keys[id][level];
        if (isDead(cell)) used.add(cell.dead);
        else if (cell !== null) expect(cell).toHaveLength(1);
      }
    }
    expect([...used].sort()).toEqual(Object.keys(layout.deadKeys).sort());
  });
});

test("the Programmer variant has no dead keys without AltGr", () => {
  for (const id of KEY_IDS) {
    const { base, shift } = CZECH_QWERTY_INTERNATIONAL_PROGRAMMER.keys[id];
    expect([id, isDead(base) || isDead(shift)]).toEqual([id, false]);
  }
  expect(CZECH_QWERTY_INTERNATIONAL_PROGRAMMER.keys.Quote).toMatchObject({ base: "'", shift: '"' });
});

test("the layouts differ only in where the accents are typed", () => {
  const accentKeys = new Set<KeyId>(["Backquote", "Digit6", "Quote"]);
  for (const id of KEY_IDS.filter((k) => !accentKeys.has(k))) {
    expect(CZECH_QWERTY_INTERNATIONAL_PROGRAMMER.keys[id]).toEqual(CZECH_QWERTY_INTERNATIONAL.keys[id]);
  }
});
