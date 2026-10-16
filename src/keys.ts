/**
 * Physical keys of an ANSI/ISO keyboard that produce characters, with the
 * identifiers each platform uses for them. Key ids follow the W3C
 * `KeyboardEvent.code` names.
 */

export interface PhysicalKey {
  /** W3C `KeyboardEvent.code` name. */
  id: KeyId;
  /** Windows set-1 scan code. */
  scancode: number;
  /** Windows virtual key, as the suffix of its `VK_` constant ('A', '1', 'OEM_7'). */
  vk: string;
  /** XKB key name (evdev). */
  xkb: string;
  /** macOS virtual key code. */
  mac: number;
  /** Row on the diagram, 0 = number row. */
  row: number;
}

export const KEY_IDS = [
  "Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6",
  "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal",
  "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO",
  "KeyP", "BracketLeft", "BracketRight", "Backslash",
  "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL",
  "Semicolon", "Quote",
  "IntlBackslash", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
  "Comma", "Period", "Slash",
  "Space",
] as const;

export type KeyId = (typeof KEY_IDS)[number];

type Row = [KeyId, number, string, string, number];

const ROWS: Row[][] = [
  [
    ["Backquote", 0x29, "OEM_3", "TLDE", 50],
    ["Digit1", 0x02, "1", "AE01", 18],
    ["Digit2", 0x03, "2", "AE02", 19],
    ["Digit3", 0x04, "3", "AE03", 20],
    ["Digit4", 0x05, "4", "AE04", 21],
    ["Digit5", 0x06, "5", "AE05", 23],
    ["Digit6", 0x07, "6", "AE06", 22],
    ["Digit7", 0x08, "7", "AE07", 26],
    ["Digit8", 0x09, "8", "AE08", 28],
    ["Digit9", 0x0a, "9", "AE09", 25],
    ["Digit0", 0x0b, "0", "AE10", 29],
    ["Minus", 0x0c, "OEM_MINUS", "AE11", 27],
    ["Equal", 0x0d, "OEM_PLUS", "AE12", 24],
  ],
  [
    ["KeyQ", 0x10, "Q", "AD01", 12],
    ["KeyW", 0x11, "W", "AD02", 13],
    ["KeyE", 0x12, "E", "AD03", 14],
    ["KeyR", 0x13, "R", "AD04", 15],
    ["KeyT", 0x14, "T", "AD05", 17],
    ["KeyY", 0x15, "Y", "AD06", 16],
    ["KeyU", 0x16, "U", "AD07", 32],
    ["KeyI", 0x17, "I", "AD08", 34],
    ["KeyO", 0x18, "O", "AD09", 31],
    ["KeyP", 0x19, "P", "AD10", 35],
    ["BracketLeft", 0x1a, "OEM_4", "AD11", 33],
    ["BracketRight", 0x1b, "OEM_6", "AD12", 30],
    ["Backslash", 0x2b, "OEM_5", "BKSL", 42],
  ],
  [
    ["KeyA", 0x1e, "A", "AC01", 0],
    ["KeyS", 0x1f, "S", "AC02", 1],
    ["KeyD", 0x20, "D", "AC03", 2],
    ["KeyF", 0x21, "F", "AC04", 3],
    ["KeyG", 0x22, "G", "AC05", 5],
    ["KeyH", 0x23, "H", "AC06", 4],
    ["KeyJ", 0x24, "J", "AC07", 38],
    ["KeyK", 0x25, "K", "AC08", 40],
    ["KeyL", 0x26, "L", "AC09", 37],
    ["Semicolon", 0x27, "OEM_1", "AC10", 41],
    ["Quote", 0x28, "OEM_7", "AC11", 39],
  ],
  [
    ["IntlBackslash", 0x56, "OEM_102", "LSGT", 10],
    ["KeyZ", 0x2c, "Z", "AB01", 6],
    ["KeyX", 0x2d, "X", "AB02", 7],
    ["KeyC", 0x2e, "C", "AB03", 8],
    ["KeyV", 0x2f, "V", "AB04", 9],
    ["KeyB", 0x30, "B", "AB05", 11],
    ["KeyN", 0x31, "N", "AB06", 45],
    ["KeyM", 0x32, "M", "AB07", 46],
    ["Comma", 0x33, "OEM_COMMA", "AB08", 43],
    ["Period", 0x34, "OEM_PERIOD", "AB09", 47],
    ["Slash", 0x35, "OEM_2", "AB10", 44],
  ],
  [["Space", 0x39, "SPACE", "SPCE", 49]],
];

export const PHYSICAL_KEYS: readonly PhysicalKey[] = ROWS.flatMap((keys, row) =>
  keys.map(([id, scancode, vk, xkb, mac]) => ({ id, scancode, vk, xkb, mac, row })),
);
