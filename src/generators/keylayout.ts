/**
 * macOS keyboard layout (.keylayout). Option plays the role of AltGr; dead
 * keys are states that the next key's action resolves.
 */
import { codeUnit, hex4, isAlphanumeric } from "../chars";
import { type KeyId, PHYSICAL_KEYS } from "../keys";
import { type Cell, type KeyLevels, type Layout, capsLock, deadKeyEntries, deadKeyList, isDead } from "../model";
import { GENERATED_NOTICE, PROJECT } from "../project";

/** Non-character keys every keyMap needs (Return, Tab, Delete, arrows, keypad...), as in Apple's U.S. layout. */
const SPECIAL_KEYS: [code: number, output: string][] = [
  [36, "\r"], [48, "\t"], [51, "\b"], [52, "\x03"], [53, "\x1b"], [64, "\x10"],
  [65, "."], [67, "*"], [69, "+"], [71, "\x1b"], [75, "/"], [76, "\x03"], [78, "-"],
  [79, "\x10"], [80, "\x10"], [81, "="], [82, "0"], [83, "1"], [84, "2"], [85, "3"],
  [86, "4"], [87, "5"], [88, "6"], [89, "7"], [90, "\x10"], [91, "8"], [92, "9"],
  [96, "\x10"], [97, "\x10"], [98, "\x10"], [99, "\x10"], [100, "\x10"], [101, "\x10"],
  [103, "\x10"], [105, "\x10"], [106, "\x10"], [107, "\x10"], [109, "\x10"], [111, "\x10"],
  [113, "\x10"], [114, "\x05"], [115, "\x01"], [116, "\x0b"], [117, "\x7f"], [118, "\x10"],
  [119, "\x04"], [120, "\x10"], [121, "\x0c"], [122, "\x10"], [123, "\x1c"], [124, "\x1d"],
  [125, "\x1f"], [126, "\x1e"],
];

/** Control characters of the non-letter keys, as in Apple's U.S. layout. */
const MAC_CONTROL_CHARS: Partial<Record<KeyId, string>> = {
  BracketLeft: "\x1b",
  Backslash: "\x1c",
  BracketRight: "\x1d",
  Digit6: "\x1e",
  Minus: "\x1f",
};

/** Control + A..Z types U+0001..U+001A; other keys type their control character or their normal one. */
function controlChar(levels: KeyLevels, id: KeyId): Cell {
  const letter = /^Key([A-Z])$/.exec(id)?.[1];
  if (letter) return String.fromCharCode(codeUnit(letter) - 0x40);
  return MAC_CONTROL_CHARS[id] ?? levels.base;
}

interface KeyMap {
  /** keyMapSelect modifier combinations ("?" = optional). */
  modifiers: string[];
  cell: (levels: KeyLevels, id: KeyId) => Cell;
}

const KEY_MAPS: KeyMap[] = [
  { modifiers: ["command?"], cell: (l) => l.base },
  { modifiers: ["anyShift caps? command?"], cell: (l) => l.shift },
  { modifiers: ["caps"], cell: (l) => (capsLock(l).base ? l.shift : l.base) },
  { modifiers: ["anyOption"], cell: (l) => l.altgr },
  { modifiers: ["anyShift caps? anyOption"], cell: (l) => l.shiftAltgr },
  { modifiers: ["caps anyOption"], cell: (l) => (capsLock(l).altgr ? l.shiftAltgr : l.altgr) },
  { modifiers: ["anyControl anyShift? caps? anyOption? command?"], cell: controlChar },
];

const XML_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

/** Escapes text for an XML 1.1 attribute; control characters become character references. */
function escape(text: string): string {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) return `&#x${hex4(code).toUpperCase()};`;
      return XML_ENTITIES[char] ?? char;
    })
    .join("");
}

const actionId = (char: string) => (isAlphanumeric(char) ? char : `u${hex4(codeUnit(char))}`);

function modifierMap(): string[] {
  return KEY_MAPS.flatMap((map, index) => [
    `    <keyMapSelect mapIndex="${index}">`,
    ...map.modifiers.map((keys) => `      <modifier keys="${keys}"/>`),
    "    </keyMapSelect>",
  ]);
}

export function keylayout(layout: Layout): string {
  const deadKeys = deadKeyList(layout.deadKeys).map(([accent, deadKey]) => ({
    accent,
    char: deadKey.char,
    compose: new Map(deadKeyEntries(deadKey)),
  }));
  // Characters that combine with a dead key need an action instead of a plain output.
  const composable = new Set(deadKeys.flatMap((d) => [...d.compose.keys()]));

  const keyElement = (code: number, cell: Cell): string | null => {
    if (cell === null) return null;
    if (isDead(cell)) return `<key code="${code}" action="dead-${cell.dead}"/>`;
    if (composable.has(cell)) return `<key code="${code}" action="${actionId(cell)}"/>`;
    return `<key code="${code}" output="${escape(cell)}"/>`;
  };

  const keyMaps = KEY_MAPS.flatMap((map, index) => {
    const keys = [
      ...PHYSICAL_KEYS.map((key) => keyElement(key.mac, map.cell(layout.keys[key.id], key.id))),
      ...SPECIAL_KEYS.map(([code, output]) => keyElement(code, output)),
    ].filter((k) => k !== null);
    return [`    <keyMap index="${index}">`, ...keys.map((k) => `      ${k}`), "    </keyMap>"];
  });

  const actions = [
    ...deadKeys.flatMap(({ accent }) => [
      `    <action id="dead-${accent}">`,
      `      <when state="none" next="${accent}"/>`,
      "    </action>",
    ]),
    ...[...composable].flatMap((char) => [
      `    <action id="${actionId(char)}">`,
      `      <when state="none" output="${escape(char)}"/>`,
      ...deadKeys
        .filter(({ compose }) => compose.has(char))
        .map(({ accent, compose }) => `      <when state="${accent}" output="${escape(compose.get(char)!)}"/>`),
      "    </action>",
    ]),
  ];

  const terminators = deadKeys.map(({ accent, char }) => `    <when state="${accent}" output="${escape(char)}"/>`);

  return [
    '<?xml version="1.1" encoding="UTF-8"?>',
    '<!DOCTYPE keyboard SYSTEM "file://localhost/System/Library/DTDs/KeyboardLayout.dtd">',
    "<!--",
    `  ${layout.name}: ${layout.summary}`,
    `  ${GENERATED_NOTICE}`,
    `  ${PROJECT.homepage}`,
    "-->",
    `<keyboard group="126" id="${layout.macId}" name="${escape(layout.name)}" maxout="1">`,
    "  <layouts>",
    '    <layout first="0" last="17" mapSet="ANSI" modifiers="Modifiers"/>',
    "  </layouts>",
    '  <modifierMap id="Modifiers" defaultIndex="0">',
    ...modifierMap(),
    "  </modifierMap>",
    '  <keyMapSet id="ANSI">',
    ...keyMaps,
    "  </keyMapSet>",
    "  <actions>",
    ...actions,
    "  </actions>",
    "  <terminators>",
    ...terminators,
    "  </terminators>",
    "</keyboard>",
    "",
  ].join("\n");
}

export const keylayoutFileName = (layout: Layout) => `${layout.name}.keylayout`;
