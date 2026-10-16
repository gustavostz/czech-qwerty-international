/**
 * Checks the compiled Windows DLLs (run `bun run build` first) against the
 * layout definition and against Windows' own US-International layout.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type KeyId, PHYSICAL_KEYS } from "../src/keys";
import { LAYOUTS } from "../src/layout";
import { US_INTERNATIONAL_DEAD_KEYS, US_INTERNATIONAL_KEYS } from "../src/layout/us-international";
import { type Accent, type Cell, LEVELS, type Layout, type Level, capsLock, deadChar, deadKeyEntries, deadKeyList, isDead } from "../src/model";
import {
  type KbdLayout,
  type KbdOutput,
  type Keystroke,
  MODIFIERS,
  loadKbdDll,
  translate,
  typeKeys,
  vkCode,
} from "../src/windows/kbd-dll";

const BUILD = join(import.meta.dir, "..", "build", "windows");
const SYSTEM32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");

const LEVEL_MODIFIERS: Record<Level, number> = {
  base: 0,
  shift: MODIFIERS.shift,
  altgr: MODIFIERS.altgr,
  shiftAltgr: MODIFIERS.shift | MODIFIERS.altgr,
};
const CAPS_SWAP: Record<Level, Level> = { base: "shift", shift: "base", altgr: "shiftAltgr", shiftAltgr: "altgr" };

function expected(layout: Layout, cell: Cell): KbdOutput | null {
  if (cell === null) return null;
  if (isDead(cell)) return { kind: "dead", text: deadChar(layout, cell.dead) };
  return { kind: "char", text: cell };
}

/** The keystroke for the first key and level whose cell matches. */
function findStroke(layout: Layout, matches: (cell: Cell) => boolean): Keystroke | undefined {
  for (const key of PHYSICAL_KEYS) {
    for (const level of LEVELS) {
      if (matches(layout.keys[key.id][level])) return { vk: vkCode(key.vk), modifiers: LEVEL_MODIFIERS[level] };
    }
  }
}

function strokeForChar(layout: Layout, char: string): Keystroke {
  const stroke = findStroke(layout, (cell) => cell === char);
  if (!stroke) throw new Error(`${layout.id} cannot type ${char}`);
  return stroke;
}

function strokeForDeadKey(layout: Layout, accent: Accent): Keystroke {
  const stroke = findStroke(layout, (cell) => isDead(cell) && cell.dead === accent);
  if (!stroke) throw new Error(`${layout.id} has no ${accent} dead key`);
  return stroke;
}

/** True when a key is defined exactly as on US-International, dead keys included. */
function sameAsUsInternational(layout: Layout, id: KeyId): boolean {
  return LEVELS.every((level) => {
    const ours = layout.keys[id][level];
    const theirs = US_INTERNATIONAL_KEYS[id][level];
    if (isDead(ours) && isDead(theirs)) {
      return ours.dead === theirs.dead && deadChar(layout, ours.dead) === US_INTERNATIONAL_DEAD_KEYS[theirs.dead].char;
    }
    return ours === theirs;
  });
}

/** Every character a DLL types directly or through a dead key. */
function dllChars(dll: KbdLayout): Set<string> {
  const chars = new Set(dll.deadKeys.values());
  for (const key of dll.keys.values()) for (const state of key.states) if (state) chars.add(state.text);
  return chars;
}

function peMachine(path: string): number {
  const bytes = readFileSync(path);
  return bytes.readUInt16LE(bytes.readUInt32LE(0x3c) + 4);
}

/** Keystrokes (every modifier combination, Caps Lock off and on) where two layouts type differently. */
function differences(a: KbdLayout, b: KbdLayout, vks: Iterable<number>): string[] {
  const found: string[] = [];
  for (const vk of vks) {
    for (let modifiers = 0; modifiers < 8; modifiers++) {
      for (const caps of [false, true]) {
        const x = JSON.stringify(translate(a, vk, modifiers, caps));
        const y = JSON.stringify(translate(b, vk, modifiers, caps));
        if (x !== y) found.push(`vk 0x${vk.toString(16)}, modifiers ${modifiers}, caps ${caps}: ${x} vs ${y}`);
      }
    }
  }
  return found;
}

describe.skipIf(process.platform !== "win32")("Windows DLLs", () => {
  let usInternational: KbdLayout;
  beforeAll(() => {
    usInternational = loadKbdDll(join(SYSTEM32, "KBDUSX.DLL"));
  });

  for (const layout of LAYOUTS) {
    describe(layout.name, () => {
      let dll: KbdLayout;
      beforeAll(() => {
        const path = join(BUILD, "amd64", `${layout.dll}.dll`);
        if (!existsSync(path)) throw new Error(`${path} not found: run "bun run build" first`);
        dll = loadKbdDll(path);
      });

      test("every key types what the layout defines", () => {
        for (const key of PHYSICAL_KEYS) {
          for (const level of LEVELS) {
            const output = translate(dll, vkCode(key.vk), LEVEL_MODIFIERS[level]);
            expect({ key: key.id, level, output }).toEqual({
              key: key.id,
              level,
              output: expected(layout, layout.keys[key.id][level]),
            });
          }
        }
      });

      test("Caps Lock capitalizes letters, including AltGr letters", () => {
        for (const key of PHYSICAL_KEYS) {
          const caps = capsLock(layout.keys[key.id]);
          for (const level of LEVELS) {
            const swaps = level === "base" || level === "shift" ? caps.base : caps.altgr;
            const cell = layout.keys[key.id][swaps ? CAPS_SWAP[level] : level];
            const output = translate(dll, vkCode(key.vk), LEVEL_MODIFIERS[level], true);
            expect({ key: key.id, level, output }).toEqual({ key: key.id, level, output: expected(layout, cell) });
          }
        }
        const altgr = { vk: vkCode("R"), modifiers: MODIFIERS.altgr };
        expect(typeKeys(dll, [altgr], true)).toBe("Ř");
      });

      test("dead keys compose, and type themselves before anything else", () => {
        for (const [accent, deadKey] of deadKeyList(layout.deadKeys)) {
          const dead = strokeForDeadKey(layout, accent);
          for (const [base, composed] of deadKeyEntries(deadKey)) {
            expect(typeKeys(dll, [dead, strokeForChar(layout, base)])).toBe(composed);
          }
          expect(typeKeys(dll, [dead, strokeForChar(layout, "t")])).toBe(`${deadKey.char}t`);
        }
      });

      test("keys it does not change behave exactly like US-International", () => {
        const unchanged = PHYSICAL_KEYS.filter((k) => sameAsUsInternational(layout, k.id)).map((k) => vkCode(k.vk));
        const physical = new Set(PHYSICAL_KEYS.map((k) => vkCode(k.vk)));
        const others = [...usInternational.keys.keys()].filter((vk) => !physical.has(vk));
        expect(unchanged.length).toBeGreaterThan(30);
        expect(differences(dll, usInternational, [...unchanged, ...others])).toEqual([]);
        expect([...dll.keys.keys()].sort()).toEqual([...usInternational.keys.keys()].sort());
        expect(dll.localeFlags).toBe(usInternational.localeFlags);
        expect(dll.modifierVks).toEqual(usInternational.modifierVks);
        expect(dll.modNumber).toEqual(usInternational.modNumber);
        expect(dll.scancodes).toEqual(usInternational.scancodes);
        expect(dll.scancodesE0).toEqual(usInternational.scancodesE0);
        expect(dll.scancodesE1).toEqual(usInternational.scancodesE1);
        expect(dll.keyNames).toEqual(usInternational.keyNames);
        expect(dll.keyNamesExt).toEqual(usInternational.keyNamesExt);
      });

      test("composes everything US-International composes", () => {
        expect(dll.deadKeys.size).toBe(usInternational.deadKeys.size);
        for (const [accent, deadKey] of deadKeyList(US_INTERNATIONAL_DEAD_KEYS)) {
          for (const base of [...Object.keys(deadKey.compose), " "]) {
            const composed = usInternational.deadKeys.get(deadKey.char + base);
            const ours = dll.deadKeys.get(deadChar(layout, accent) + base);
            expect({ accent, base, composed: ours }).toEqual({
              accent,
              base,
              composed: base === " " ? deadChar(layout, accent) : composed,
            });
          }
        }
      });

      test("can type every character US-International can", () => {
        const ours = dllChars(dll);
        const missing = [...dllChars(usInternational)].filter((c) => !ours.has(c));
        expect(missing).toEqual([]);
      });

      test("builds for other processors are valid DLLs", () => {
        const machines: Record<string, number> = { amd64: 0x8664, wow64: 0x14c, x86: 0x14c, arm64: 0xaa64 };
        for (const [dir, machine] of Object.entries(machines)) {
          const file = join(BUILD, dir, `${layout.dll}.dll`);
          if (dir === "arm64" && !existsSync(file)) continue; // needs the MSVC ARM64 tools
          expect({ dir, machine: peMachine(file) }).toEqual({ dir, machine });
          expect(readFileSync(file).includes("KbdLayerDescriptor")).toBe(true);
        }
        // The WOW64 build stores 64-bit pointers, so it differs from the plain x86 build.
        expect(readFileSync(join(BUILD, "wow64", `${layout.dll}.dll`))).not.toEqual(
          readFileSync(join(BUILD, "x86", `${layout.dll}.dll`)),
        );
      });

      // Set KBDUTOOL to the kbdutool.exe of Microsoft Keyboard Layout Creator to run this (CI does).
      test.skipIf(!process.env.KBDUTOOL)("Microsoft's layout compiler builds the same layout from the .klc", () => {
        const dir = mkdtempSync(join(tmpdir(), "klc-"));
        try {
          copyFileSync(join(import.meta.dir, "..", "platforms", "windows", `${layout.dll}.klc`), join(dir, `${layout.dll}.klc`));
          const result = Bun.spawnSync([process.env.KBDUTOOL!, "-u", "-w", "-m", `${layout.dll}.klc`], { cwd: dir });
          const output = result.stdout.toString() + result.stderr.toString();
          expect(output).toContain("All tasks completed successfully");
          expect(output.toLowerCase()).not.toContain("warning");

          const msklc = loadKbdDll(join(dir, `${layout.dll}.dll`));
          expect(differences(dll, msklc, new Set([...dll.keys.keys(), ...msklc.keys.keys()]))).toEqual([]);
          expect(msklc.deadKeys).toEqual(dll.deadKeys);
          expect(msklc.keyNamesDead).toEqual(dll.keyNamesDead);
          expect(msklc.keyNames).toEqual(dll.keyNames);
          expect(msklc.keyNamesExt).toEqual(dll.keyNamesExt);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
    });
  }
});
