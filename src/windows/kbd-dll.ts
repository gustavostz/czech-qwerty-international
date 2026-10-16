/**
 * Reads the tables of a compiled 64-bit Windows keyboard layout DLL and
 * simulates typing on it, the way Windows' ToUnicodeEx does. Used by the
 * tests to check the built DLLs against the layout definition and against
 * Windows' own US-International DLL.
 *
 * The DLL is only mapped into this process (nothing is installed), so it
 * must match the process: amd64 on x64 Windows.
 */
import { FFIType, type Pointer, dlopen, read } from "bun:ffi";

const KBDSHIFT = 0x01;
const KBDCTRL = 0x02;
const KBDALT = 0x04;
export const MODIFIERS = { shift: KBDSHIFT, ctrl: KBDCTRL, alt: KBDALT, altgr: KBDCTRL | KBDALT } as const;

const SHFT_INVALID = 0x0f;
const WCH_NONE = 0xf000;
const WCH_DEAD = 0xf001;
const WCH_LGTR = 0xf002;
const CAPLOK = 0x01;
const SGCAPS = 0x02;
const CAPLOKALTGR = 0x04;

/** KBDTABLES field offsets on 64-bit Windows (kbd.h, natural alignment). */
const T = {
  pCharModifiers: 0,
  pVkToWcharTable: 8,
  pDeadKey: 16,
  pKeyNames: 24,
  pKeyNamesExt: 32,
  pKeyNamesDead: 40,
  pusVSCtoVK: 48,
  bMaxVSCtoVK: 56,
  pVSCtoVK_E0: 64,
  pVSCtoVK_E1: 72,
  fLocaleFlags: 80,
} as const;

export interface KbdOutput {
  kind: "char" | "dead";
  text: string;
}

export interface KbdKey {
  vk: number;
  attributes: number;
  /** Output per column (modification number). */
  states: (KbdOutput | null)[];
}

export interface KbdLayout {
  localeFlags: number;
  modifierVks: [vk: number, bits: number][];
  /** Modifier bits → column, SHFT_INVALID (15) where no characters are typed. */
  modNumber: number[];
  keys: Map<number, KbdKey>;
  /** `${accent}${base}` → composed character. */
  deadKeys: Map<string, string>;
  keyNames: Map<number, string>;
  keyNamesExt: Map<number, string>;
  /** Dead character → name. */
  keyNamesDead: Map<string, string>;
  /** Scan code → virtual key with flags (KBDEXT, KBDNUMPAD, ...). */
  scancodes: Map<number, number>;
  scancodesE0: Map<number, number>;
  scancodesE1: Map<number, number>;
}

const ptr = (address: number, offset = 0) => read.ptr(address as Pointer, offset);
const u8 = (address: number, offset = 0) => read.u8(address as Pointer, offset);
const u16 = (address: number, offset = 0) => read.u16(address as Pointer, offset);
const u32 = (address: number, offset = 0) => read.u32(address as Pointer, offset);

function wideString(address: number): string {
  let text = "";
  for (let i = 0; ; i += 2) {
    const unit = u16(address, i);
    if (unit === 0) return text;
    text += String.fromCharCode(unit);
  }
}

/** Reads a VSC_LPWSTR array: { BYTE vsc; WCHAR *name } (16 bytes each). */
function keyNameTable(address: number): Map<number, string> {
  const names = new Map<number, string>();
  for (let entry = address; address && u8(entry) !== 0; entry += 16) {
    names.set(u8(entry), wideString(ptr(entry, 8)));
  }
  return names;
}

/** Reads a VSC_VK array: { BYTE vsc; USHORT vk } (4 bytes each). */
function scancodeTable(address: number): Map<number, number> {
  const table = new Map<number, number>();
  for (let entry = address; address && u8(entry) !== 0; entry += 4) {
    table.set(u8(entry), u16(entry, 2));
  }
  return table;
}

function decode(wch: number, deadChar: number | undefined): KbdOutput | null {
  if (wch === WCH_NONE) return null;
  if (wch === WCH_LGTR) throw new Error("Ligatures are not supported");
  if (wch === WCH_DEAD) {
    if (deadChar === undefined) throw new Error("Dead key without a following 0xff row");
    return { kind: "dead", text: String.fromCharCode(deadChar) };
  }
  return { kind: "char", text: String.fromCharCode(wch) };
}

function walk(tables: number): KbdLayout {
  const modifiers = ptr(tables, T.pCharModifiers);
  const modifierVks: [number, number][] = [];
  for (let entry = ptr(modifiers); u8(entry) !== 0; entry += 2) modifierVks.push([u8(entry), u8(entry, 1)]);
  const maxModBits = u16(modifiers, 8);
  const modNumber = Array.from({ length: maxModBits + 1 }, (_, i) => u8(modifiers, 10 + i));

  // VK_TO_WCHAR_TABLE: { VK_TO_WCHARS *rows; BYTE nModifications; BYTE cbSize } (16 bytes each).
  const keys = new Map<number, KbdKey>();
  for (let table = ptr(tables, T.pVkToWcharTable); ptr(table) !== 0; table += 16) {
    const columns = u8(table, 8);
    const rowSize = u8(table, 9);
    const row = (address: number) => Array.from({ length: columns }, (_, i) => u16(address, 2 + 2 * i));
    for (let entry = ptr(table); u8(entry) !== 0; entry += rowSize) {
      const vk = u8(entry);
      const attributes = u8(entry, 1);
      if (attributes & SGCAPS) throw new Error("SGCAPS keys are not supported");
      const wch = row(entry);
      // A row with dead keys is followed by a 0xff row holding the dead characters.
      let deadChars: number[] = [];
      if (wch.includes(WCH_DEAD) && u8(entry + rowSize) === 0xff) {
        entry += rowSize;
        deadChars = row(entry);
      }
      keys.set(vk, { vk, attributes, states: wch.map((w, i) => decode(w, deadChars[i])) });
    }
  }

  // DEADKEY: { DWORD (accent << 16 | base); WCHAR composed; USHORT flags } (8 bytes each).
  const deadKeys = new Map<string, string>();
  for (let entry = ptr(tables, T.pDeadKey); entry && u32(entry) !== 0; entry += 8) {
    const both = u32(entry);
    const accent = String.fromCharCode(both >>> 16);
    const base = String.fromCharCode(both & 0xffff);
    deadKeys.set(accent + base, String.fromCharCode(u16(entry, 4)));
  }

  const keyNamesDead = new Map<string, string>();
  for (let entry = ptr(tables, T.pKeyNamesDead); entry && ptr(entry) !== 0; entry += 8) {
    const name = wideString(ptr(entry));
    keyNamesDead.set(name[0]!, name.slice(1));
  }

  const scancodes = new Map<number, number>();
  const vscToVk = ptr(tables, T.pusVSCtoVK);
  for (let sc = 0; sc < u8(tables, T.bMaxVSCtoVK); sc++) {
    const vk = u16(vscToVk, sc * 2);
    if ((vk & 0xff) !== 0 && (vk & 0xff) !== 0xff) scancodes.set(sc, vk);
  }

  return {
    localeFlags: u32(tables, T.fLocaleFlags),
    modifierVks,
    modNumber,
    keys,
    deadKeys,
    keyNames: keyNameTable(ptr(tables, T.pKeyNames)),
    keyNamesExt: keyNameTable(ptr(tables, T.pKeyNamesExt)),
    keyNamesDead,
    scancodes,
    scancodesE0: scancodeTable(ptr(tables, T.pVSCtoVK_E0)),
    scancodesE1: scancodeTable(ptr(tables, T.pVSCtoVK_E1)),
  };
}

export function loadKbdDll(path: string): KbdLayout {
  const library = dlopen(path, { KbdLayerDescriptor: { args: [], returns: FFIType.ptr } });
  try {
    const tables = library.symbols.KbdLayerDescriptor();
    if (!tables) throw new Error(`${path}: KbdLayerDescriptor() returned NULL`);
    return walk(tables);
  } finally {
    library.close();
  }
}

/**
 * What one keystroke produces, before dead-key composition. Mirrors win32k:
 * plain Alt types nothing extra, Caps Lock acts as Shift for CAPLOK keys
 * (without other modifiers) and for CAPLOKALTGR keys (with AltGr), and
 * Ctrl+A..Z fall back to control characters.
 */
export function translate(layout: KbdLayout, vk: number, modifiers: number, capsLock = false): KbdOutput | null {
  const key = layout.keys.get(vk);
  if (!key) return null;
  let bits = modifiers;
  if ((bits & (KBDALT | KBDCTRL)) === KBDALT) bits &= ~KBDALT;
  if (capsLock) {
    const plain = (bits & ~KBDSHIFT) === 0;
    const altgr = (bits & (KBDCTRL | KBDALT)) === (KBDCTRL | KBDALT);
    if ((key.attributes & CAPLOK && plain) || (key.attributes & CAPLOKALTGR && altgr)) bits ^= KBDSHIFT;
  }
  const column = layout.modNumber[bits];
  if (column === undefined || column === SHFT_INVALID) return null;
  const output = key.states[column] ?? null;
  if (!output && vk >= 0x41 && vk <= 0x5a && modifiers & KBDCTRL && !(modifiers & KBDALT)) {
    return { kind: "char", text: String.fromCharCode(vk - 0x40) };
  }
  return output;
}

export interface Keystroke {
  vk: number;
  modifiers?: number;
}

/**
 * Types a sequence of keystrokes, applying dead keys like Windows does. A
 * dead key at the end is still waiting for its letter, so it types nothing.
 */
export function typeKeys(layout: KbdLayout, strokes: Keystroke[], capsLock = false): string {
  let text = "";
  let pending: string | null = null;
  for (const stroke of strokes) {
    const output = translate(layout, stroke.vk, stroke.modifiers ?? 0, capsLock);
    if (!output) continue;
    if (pending === null) {
      if (output.kind === "dead") pending = output.text;
      else text += output.text;
      continue;
    }
    // A matching composition types the composed character; anything else
    // types the dead key's own character followed by the new one.
    text += layout.deadKeys.get(pending + output.text) ?? pending + output.text;
    pending = null;
  }
  return text;
}

/** Windows virtual-key code for the `vk` names used in src/keys.ts. */
export function vkCode(name: string): number {
  if (/^[A-Z0-9]$/.test(name)) return name.charCodeAt(0);
  const codes: Record<string, number> = {
    SPACE: 0x20,
    OEM_1: 0xba,
    OEM_PLUS: 0xbb,
    OEM_COMMA: 0xbc,
    OEM_MINUS: 0xbd,
    OEM_PERIOD: 0xbe,
    OEM_2: 0xbf,
    OEM_3: 0xc0,
    OEM_4: 0xdb,
    OEM_5: 0xdc,
    OEM_6: 0xdd,
    OEM_7: 0xde,
    OEM_102: 0xe2,
  };
  const code = codes[name];
  if (code === undefined) throw new Error(`Unknown virtual key ${name}`);
  return code;
}
