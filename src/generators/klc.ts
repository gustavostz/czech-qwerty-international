/**
 * Microsoft Keyboard Layout Creator (MSKLC) source files. The DLLs are built
 * without MSKLC (see scripts/build-windows.ts); the .klc files let people open
 * and customize the layout in MSKLC or KbdEdit.
 */
import { codeUnit, hex4, isAlphanumeric } from "../chars";
import { PHYSICAL_KEYS } from "../keys";
import { type Cell, LEVELS, type Layout, capsLock, deadChar, deadKeyEntries, isDead } from "../model";
import { GENERATED_NOTICE, PROJECT } from "../project";
import { CONTROL_CHARS, KEY_NAMES, KEY_NAMES_EXT, WCH_NONE } from "../windows/kbdusx-tables";

const hex = (char: string) => hex4(codeUnit(char));
const scancodeHex = (scancode: number) => scancode.toString(16).padStart(2, "0");
const quoted = (name: string) => (name.includes(" ") ? `"${name}"` : name);

/** A LAYOUT cell: letters and digits as themselves, other characters as hex, dead keys marked with @. */
function klcCell(layout: Layout, cell: Cell): string {
  if (cell === null) return "-1";
  if (isDead(cell)) return `${hex(deadChar(layout, cell.dead))}@`;
  return isAlphanumeric(cell) ? cell : hex(cell);
}

function klcControl(code: number | undefined): string {
  return code === undefined || code === WCH_NONE ? "-1" : hex4(code);
}

/** A cell as shown in comments; spaces and dead keys need words. */
function show(layout: Layout, cell: Cell): string {
  if (cell === null) return "-";
  if (isDead(cell)) return `dead ${deadChar(layout, cell.dead)}`;
  return cell === " " ? "space" : cell;
}

export function klc(layout: Layout): string {
  const rows = PHYSICAL_KEYS.map((key) => {
    const levels = layout.keys[key.id];
    const caps = capsLock(levels);
    const [ctrl, shiftCtrl] = CONTROL_CHARS[key.id] ?? [];
    const columns = [
      klcCell(layout, levels.base),
      klcCell(layout, levels.shift),
      klcControl(ctrl),
      klcControl(shiftCtrl),
      klcCell(layout, levels.altgr),
      klcCell(layout, levels.shiftAltgr),
    ];
    const cap = (caps.base ? 1 : 0) | (caps.altgr ? 4 : 0);
    const comment = LEVELS.map((level) => show(layout, levels[level])).join("  ");
    return `${scancodeHex(key.scancode)}\t${key.vk.padEnd(8)}\t${cap}\t${columns.join("\t")}\t// ${comment}`;
  });

  const deadKeys = Object.values(layout.deadKeys).flatMap((deadKey) => [
    `DEADKEY\t${hex(deadKey.char)}`,
    "",
    ...deadKeyEntries(deadKey).map(
      ([base, composed]) => `${hex(base)}\t${hex(composed)}\t// ${base === " " ? "space" : base} -> ${composed}`,
    ),
    "",
  ]);

  return [
    `KBD\t${layout.dll}\t"${layout.name}"`,
    "",
    `COPYRIGHT\t"${PROJECT.copyright}"`,
    "",
    `COMPANY\t"${PROJECT.author}"`,
    "",
    'LOCALENAME\t"en-US"',
    "",
    'LOCALEID\t"00000409"',
    "",
    "VERSION\t1.0",
    "",
    `// ${GENERATED_NOTICE}`,
    `// ${PROJECT.homepage}`,
    "",
    "SHIFTSTATE",
    "",
    "0\t//Column 4",
    "1\t//Column 5 : Shft",
    "2\t//Column 6 :       Ctrl",
    "3\t//Column 7 : Shft  Ctrl",
    "6\t//Column 8 :       Ctrl Alt",
    "7\t//Column 9 : Shft  Ctrl Alt",
    "",
    "LAYOUT\t\t;an extra '@' at the end is a dead key",
    "",
    "//SC\tVK_\t\tCap\t0\t1\t2\t3\t6\t7",
    "//--\t----\t\t----\t----\t----\t----\t----\t----\t----",
    "",
    ...rows,
    "53\tDECIMAL \t0\t002e\t002e\t-1\t-1\t-1\t-1",
    "",
    ...deadKeys,
    "KEYNAME",
    "",
    ...KEY_NAMES.map(([sc, name]) => `${scancodeHex(sc)}\t${quoted(name)}`),
    "",
    "KEYNAME_EXT",
    "",
    ...KEY_NAMES_EXT.map(([sc, name]) => `${scancodeHex(sc)}\t${quoted(name)}`),
    "",
    "KEYNAME_DEAD",
    "",
    ...Object.values(layout.deadKeys).map((d) => `${hex(d.char)}\t"${d.name}"`),
    "",
    "DESCRIPTIONS",
    "",
    `0409\t${layout.name}`,
    "",
    "LANGUAGENAMES",
    "",
    "0409\tEnglish (United States)",
    "",
    "ENDKBD",
    "",
  ].join("\n");
}

/** MSKLC reads .klc files as UTF-16 LE with a byte order mark and CRLF line endings. */
export function klcBytes(text: string): Buffer {
  return Buffer.from(`﻿${text.replaceAll("\n", "\r\n")}`, "utf16le");
}
