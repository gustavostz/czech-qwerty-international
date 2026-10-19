/**
 * Windows-only parts of a layout, copied from KBDUSX.DLL (US-International)
 * and shared by the DLL and KLC generators.
 */
import type { KeyId } from "../keys";

export const WCH_NONE = 0xf000;

/** Control characters typed with Ctrl / Shift+Ctrl. */
export const CONTROL_CHARS: Partial<Record<KeyId, [ctrl: number, shiftCtrl: number]>> = {
  Digit2: [WCH_NONE, 0x00],
  Digit6: [WCH_NONE, 0x1e],
  Minus: [WCH_NONE, 0x1f],
  BracketLeft: [0x1b, WCH_NONE],
  BracketRight: [0x1d, WCH_NONE],
  Backslash: [0x1c, WCH_NONE],
  IntlBackslash: [0x1c, WCH_NONE],
  Space: [0x20, WCH_NONE],
};

/** Key names shown by Windows (e.g. in shortcut editors). */
export const KEY_NAMES: [scancode: number, name: string][] = [
  [0x01, "ESC"],
  [0x0e, "BACKSPACE"],
  [0x0f, "TAB"],
  [0x1c, "ENTER"],
  [0x1d, "CTRL"],
  [0x2a, "SHIFT"],
  [0x36, "RIGHT SHIFT"],
  [0x37, "NUMMULT"],
  [0x38, "ALT"],
  [0x39, "SPACE"],
  [0x3a, "CAPSLOCK"],
  [0x3b, "F1"],
  [0x3c, "F2"],
  [0x3d, "F3"],
  [0x3e, "F4"],
  [0x3f, "F5"],
  [0x40, "F6"],
  [0x41, "F7"],
  [0x42, "F8"],
  [0x43, "F9"],
  [0x44, "F10"],
  [0x45, "Pause"],
  [0x46, "SCROLL LOCK"],
  [0x47, "NUM 7"],
  [0x48, "NUM 8"],
  [0x49, "NUM 9"],
  [0x4a, "NUM SUB"],
  [0x4b, "NUM 4"],
  [0x4c, "NUM 5"],
  [0x4d, "NUM 6"],
  [0x4e, "NUM PLUS"],
  [0x4f, "NUM 1"],
  [0x50, "NUM 2"],
  [0x51, "NUM 3"],
  [0x52, "NUM 0"],
  [0x53, "NUM DECIMAL"],
  [0x57, "F11"],
  [0x58, "F12"],
];

/** Names of keys with an E0 scan code prefix. */
export const KEY_NAMES_EXT: [scancode: number, name: string][] = [
  [0x1c, "NUM ENTER"],
  [0x1d, "Right Ctrl"],
  [0x35, "NUM DIVIDE"],
  [0x37, "Prnt Scrn"],
  [0x38, "RIGHT ALT"],
  [0x45, "Num Lock"],
  [0x46, "Break"],
  [0x47, "HOME"],
  [0x48, "UP"],
  [0x49, "PGUP"],
  [0x4b, "LEFT"],
  [0x4d, "RIGHT"],
  [0x4f, "END"],
  [0x50, "DOWN"],
  [0x51, "PGDOWN"],
  [0x52, "INSERT"],
  [0x53, "DELETE"],
  [0x54, "<00>"],
  [0x56, "Help"],
  [0x5b, "Left Windows"],
  [0x5c, "Right Windows"],
  [0x5d, "Application"],
];
