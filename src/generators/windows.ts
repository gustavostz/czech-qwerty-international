/**
 * Sources for a native Windows keyboard layout DLL: C tables for <kbd.h>, a
 * module definition and a version resource. The table layout follows
 * Microsoft's kbdus sample and matches KBDUSX.DLL (US-International), so the
 * keys this project does not change behave exactly like US-International.
 */
import { codeUnit, hex4 } from "../chars";
import { type KeyId, PHYSICAL_KEYS } from "../keys";
import { type Cell, type Layout, LEVELS, capsLock, deadChar, deadKeyEntries, isDead } from "../model";
import { GENERATED_NOTICE, PROJECT } from "../project";
import { CONTROL_CHARS, KEY_NAMES, KEY_NAMES_EXT, WCH_NONE } from "../windows/kbdusx-tables";

const WCH_DEAD = 0xf001;

/** Character table columns, in the order KBDUSX.DLL uses. */
const COLUMNS = ["Base", "Shift", "AltGr", "S+AltGr", "Ctrl", "S+Ctrl"];

interface Row {
  vk: string;
  attributes: string;
  chars: number[];
  /** Characters of the dead keys in `chars`, emitted as the 0xff row that follows. */
  deadChars?: number[];
}

const NONE = WCH_NONE;

/** Editing and numpad keys, identical on every US-based layout. */
const FIXED_ROWS: Row[] = [
  { vk: "VK_BACK", attributes: "0", chars: [0x08, 0x08, NONE, NONE, 0x7f] },
  { vk: "VK_ESCAPE", attributes: "0", chars: [0x1b, 0x1b, NONE, NONE, 0x1b] },
  { vk: "VK_RETURN", attributes: "0", chars: [0x0d, 0x0d, NONE, NONE, 0x0a] },
  { vk: "VK_CANCEL", attributes: "0", chars: [0x03, 0x03, NONE, NONE, 0x03] },
  { vk: "VK_DECIMAL", attributes: "0", chars: [0x2e, 0x2e] },
  { vk: "VK_TAB", attributes: "0", chars: [0x09, 0x09] },
  { vk: "VK_ADD", attributes: "0", chars: [0x2b, 0x2b] },
  { vk: "VK_DIVIDE", attributes: "0", chars: [0x2f, 0x2f] },
  { vk: "VK_MULTIPLY", attributes: "0", chars: [0x2a, 0x2a] },
  { vk: "VK_SUBTRACT", attributes: "0", chars: [0x2d, 0x2d] },
  ...[..."0123456789"].map((digit) => ({
    vk: `VK_NUMPAD${digit}`,
    attributes: "0",
    chars: [digit.charCodeAt(0)],
  })),
];

function encode(cell: Cell): number {
  if (cell === null) return WCH_NONE;
  if (isDead(cell)) return WCH_DEAD;
  return codeUnit(cell);
}

function keyRow(layout: Layout, id: KeyId, vk: string): Row {
  const levels = layout.keys[id];
  const cells = LEVELS.map((level) => levels[level]);
  const caps = capsLock(levels);
  const attributes = [caps.base && "CAPLOK", caps.altgr && "CAPLOKALTGR"].filter(Boolean).join(" | ");
  const row: Row = {
    vk: vk.length === 1 ? `'${vk}'` : `VK_${vk}`,
    attributes: attributes || "0",
    chars: [...cells.map(encode), ...(CONTROL_CHARS[id] ?? [])],
  };
  if (cells.some(isDead)) {
    row.deadChars = cells.map((cell) => (isDead(cell) ? codeUnit(deadChar(layout, cell.dead)) : WCH_NONE));
  }
  return row;
}

/** Number of columns a row needs: up to its last defined character. */
function width(row: Row): number {
  let n = row.chars.length;
  while (n > 1 && row.chars[n - 1] === WCH_NONE) n--;
  return n;
}

/** A character table value as C source. */
function cValue(value: number): string {
  if (value === WCH_NONE) return "WCH_NONE";
  if (value === WCH_DEAD) return "WCH_DEAD";
  return `0x${hex4(value)}`;
}

function charTable(n: number, rows: Row[]): string {
  const line = (vk: string, attributes: string, values: string[]) =>
    `  { ${[vk.padEnd(14), attributes.padEnd(20), ...values.map((v) => v.padEnd(8))].join(", ").trimEnd()} },`;
  const values = (chars: number[]) => Array.from({ length: n }, (_, i) => cValue(chars[i] ?? WCH_NONE));
  const lines = [
    `static ALLOC_SECTION_LDATA VK_TO_WCHARS${n} aVkToWch${n}[] = {`,
    `  // ${"VK".padEnd(14)}  ${"Attributes".padEnd(20)}  ${COLUMNS.slice(0, n).map((c) => c.padEnd(8)).join("  ")}`.trimEnd(),
  ];
  for (const row of rows) {
    lines.push(line(row.vk, row.attributes, values(row.chars)));
    if (row.deadChars) lines.push(line("0xff", "0", values(row.deadChars)));
  }
  lines.push(`  { ${Array(n + 2).fill("0").join(", ")} }`, "};");
  return lines.join("\n");
}

function deadKeyTable(layout: Layout): string {
  const entries: string[] = [];
  for (const deadKey of Object.values(layout.deadKeys)) {
    const accent = codeUnit(deadKey.char);
    for (const [base, composed] of deadKeyEntries(deadKey)) {
      entries.push(`    DEADTRANS(${cValue(codeUnit(base))}, ${cValue(accent)}, ${cValue(codeUnit(composed))}, 0x0000),`);
    }
  }
  return ["static ALLOC_SECTION_LDATA DEADKEY aDeadKey[] = {", ...entries, "    { 0, 0, 0 }", "};"].join("\n");
}

function keyNameTable(name: string, names: [number, string][]): string {
  const entries = names.map(([scancode, keyName]) => `    0x${scancode.toString(16).padStart(2, "0")}, L"${keyName}",`);
  return [`static ALLOC_SECTION_LDATA VSC_LPWSTR ${name}[] = {`, ...entries, "    0,    NULL", "};"].join("\n");
}

function deadKeyNames(layout: Layout): string {
  // The dead character and its name are separate literals so that a name
  // starting with a hex digit is not read as part of the \x escape.
  const names = Object.values(layout.deadKeys).map(
    (d) => `    L"\\x${hex4(codeUnit(d.char))}" L"${d.name}",`,
  );
  return ["static ALLOC_SECTION_LDATA DEADKEY_LPWSTR aKeyNamesDead[] = {", ...names, "    NULL", "};"].join("\n");
}

export function windowsSource(layout: Layout): string {
  const rows = [
    ...PHYSICAL_KEYS.map((k) => keyRow(layout, k.id, k.vk)),
    ...FIXED_ROWS,
  ];
  const tables = Map.groupBy(rows, width);
  // Wider tables first and the numpad (width 1) last, so VkKeyScan finds
  // characters on the main keys before the numpad, as in Microsoft's layouts.
  const widths = [...tables.keys()].sort((a, b) => b - a);

  return `/*
 * ${layout.name} keyboard layout (${layout.dll}.dll)
 * ${layout.summary}
 *
 * ${GENERATED_NOTICE}
 * ${PROJECT.name} ${PROJECT.version}, ${PROJECT.homepage}
 */

#define KBD_TYPE 4

#include <windows.h>
#include <kbd.h>

#if defined(_M_IA64)
#pragma section(".data")
#define ALLOC_SECTION_LDATA __declspec(allocate(".data"))
#else
#pragma data_seg(".data")
#define ALLOC_SECTION_LDATA
#endif

/* Scan codes to virtual keys: standard US mapping from kbd.h. */
static ALLOC_SECTION_LDATA USHORT ausVK[] = {
    T00, T01, T02, T03, T04, T05, T06, T07,
    T08, T09, T0A, T0B, T0C, T0D, T0E, T0F,
    T10, T11, T12, T13, T14, T15, T16, T17,
    T18, T19, T1A, T1B, T1C, T1D, T1E, T1F,
    T20, T21, T22, T23, T24, T25, T26, T27,
    T28, T29, T2A, T2B, T2C, T2D, T2E, T2F,
    T30, T31, T32, T33, T34, T35,
    T36 | KBDEXT,                   /* Right Shift */
    T37 | KBDMULTIVK,               /* numpad * + Shift/Alt -> SnapShot */
    T38, T39, T3A, T3B, T3C, T3D, T3E,
    T3F, T40, T41, T42, T43, T44,
    T45 | KBDEXT | KBDMULTIVK,      /* NumLock / Pause */
    T46 | KBDMULTIVK,               /* Scroll Lock */
    T47 | KBDNUMPAD | KBDSPECIAL,   /* Numpad 7 (Home) */
    T48 | KBDNUMPAD | KBDSPECIAL,   /* Numpad 8 (Up) */
    T49 | KBDNUMPAD | KBDSPECIAL,   /* Numpad 9 (PgUp) */
    T4A,
    T4B | KBDNUMPAD | KBDSPECIAL,   /* Numpad 4 (Left) */
    T4C | KBDNUMPAD | KBDSPECIAL,   /* Numpad 5 (Clear) */
    T4D | KBDNUMPAD | KBDSPECIAL,   /* Numpad 6 (Right) */
    T4E,
    T4F | KBDNUMPAD | KBDSPECIAL,   /* Numpad 1 (End) */
    T50 | KBDNUMPAD | KBDSPECIAL,   /* Numpad 2 (Down) */
    T51 | KBDNUMPAD | KBDSPECIAL,   /* Numpad 3 (PgDn) */
    T52 | KBDNUMPAD | KBDSPECIAL,   /* Numpad 0 (Ins) */
    T53 | KBDNUMPAD | KBDSPECIAL,   /* Numpad . (Del) */
    T54, T55, T56, T57, T58, T59, T5A, T5B,
    T5C, T5D, T5E, T5F, T60, T61, T62, T63,
    T64, T65, T66, T67, T68, T69, T6A, T6B,
    T6C, T6D, T6E, T6F, T70, T71, T72, T73,
    T74, T75, T76, T77, T78, T79, T7A, T7B,
    T7C, T7D, T7E
};

static ALLOC_SECTION_LDATA VSC_VK aE0VscToVk[] = {
    { 0x10, X10 | KBDEXT }, { 0x19, X19 | KBDEXT }, { 0x1D, X1D | KBDEXT },
    { 0x20, X20 | KBDEXT }, { 0x21, X21 | KBDEXT }, { 0x22, X22 | KBDEXT },
    { 0x24, X24 | KBDEXT }, { 0x2E, X2E | KBDEXT }, { 0x30, X30 | KBDEXT },
    { 0x32, X32 | KBDEXT }, { 0x35, X35 | KBDEXT }, { 0x37, X37 | KBDEXT },
    { 0x38, X38 | KBDEXT }, { 0x47, X47 | KBDEXT }, { 0x48, X48 | KBDEXT },
    { 0x49, X49 | KBDEXT }, { 0x4B, X4B | KBDEXT }, { 0x4D, X4D | KBDEXT },
    { 0x4F, X4F | KBDEXT }, { 0x50, X50 | KBDEXT }, { 0x51, X51 | KBDEXT },
    { 0x52, X52 | KBDEXT }, { 0x53, X53 | KBDEXT }, { 0x5B, X5B | KBDEXT },
    { 0x5C, X5C | KBDEXT }, { 0x5D, X5D | KBDEXT }, { 0x5F, X5F | KBDEXT },
    { 0x65, X65 | KBDEXT }, { 0x66, X66 | KBDEXT }, { 0x67, X67 | KBDEXT },
    { 0x68, X68 | KBDEXT }, { 0x69, X69 | KBDEXT }, { 0x6A, X6A | KBDEXT },
    { 0x6B, X6B | KBDEXT }, { 0x6C, X6C | KBDEXT }, { 0x6D, X6D | KBDEXT },
    { 0x1C, X1C | KBDEXT },         /* Numpad Enter */
    { 0x46, X46 | KBDEXT },         /* Break (Ctrl + Pause) */
    { 0, 0 }
};

static ALLOC_SECTION_LDATA VSC_VK aE1VscToVk[] = {
    { 0x1D, Y1D },                  /* Pause */
    { 0, 0 }
};

/* Shift, Ctrl and Alt; Right Alt acts as Ctrl+Alt (AltGr, see KLLF_ALTGR). */
static ALLOC_SECTION_LDATA VK_TO_BIT aVkToBits[] = {
    { VK_SHIFT,   KBDSHIFT },
    { VK_CONTROL, KBDCTRL  },
    { VK_MENU,    KBDALT   },
    { 0,          0        }
};

static ALLOC_SECTION_LDATA MODIFIERS CharModifiers = {
    &aVkToBits[0],
    7,
    {
        0,            /* Base */
        1,            /* Shift */
        4,            /* Ctrl */
        5,            /* Shift + Ctrl */
        SHFT_INVALID, /* Alt */
        SHFT_INVALID, /* Shift + Alt */
        2,            /* Ctrl + Alt (AltGr) */
        3             /* Shift + Ctrl + Alt (Shift + AltGr) */
    }
};

${widths.map((n) => charTable(n, tables.get(n)!)).join("\n\n")}

static ALLOC_SECTION_LDATA VK_TO_WCHAR_TABLE aVkToWcharTable[] = {
${widths.map((n) => `    { (PVK_TO_WCHARS1)aVkToWch${n}, ${n}, sizeof(aVkToWch${n}[0]) },`).join("\n")}
    { NULL, 0, 0 }
};

${deadKeyTable(layout)}

${keyNameTable("aKeyNames", KEY_NAMES)}

${keyNameTable("aKeyNamesExt", KEY_NAMES_EXT)}

${deadKeyNames(layout)}

static ALLOC_SECTION_LDATA KBDTABLES KbdTables = {
    &CharModifiers,
    aVkToWcharTable,
    aDeadKey,
    aKeyNames,
    aKeyNamesExt,
    aKeyNamesDead,
    ausVK,
    sizeof(ausVK) / sizeof(ausVK[0]),
    aE0VscToVk,
    aE1VscToVk,
    MAKELONG(KLLF_ALTGR, KBD_VERSION),
    0,
    0,
    NULL
};

PKBDTABLES KbdLayerDescriptor(VOID)
{
    return &KbdTables;
}
`;
}

export function windowsModuleDefinition(layout: Layout): string {
  return `LIBRARY ${layout.dll.toUpperCase()}

EXPORTS
    KbdLayerDescriptor @1
`;
}

/** String ids read by Windows; the installer points "Layout Display Name" at 1100. */
export const LAYOUT_DISPLAY_NAME_ID = 1100;

export function windowsResource(layout: Layout): string {
  const version = PROJECT.version.split(".").map(Number);
  const fileVersion = [...version, 0].slice(0, 4).join(",");
  return `#include <windows.h>

VS_VERSION_INFO VERSIONINFO
FILEVERSION     ${fileVersion}
PRODUCTVERSION  ${fileVersion}
FILEFLAGSMASK   VS_FFI_FILEFLAGSMASK
FILEFLAGS       0
FILEOS          VOS_NT_WINDOWS32
FILETYPE        VFT_DLL
FILESUBTYPE     VFT2_DRV_KEYBOARD
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "000004B0"
        BEGIN
            VALUE "CompanyName",      "${PROJECT.author}"
            VALUE "FileDescription",  "${layout.name} Keyboard Layout"
            VALUE "FileVersion",      "${PROJECT.version}"
            VALUE "InternalName",     "${layout.dll}"
            VALUE "LegalCopyright",   "${PROJECT.copyright}. MIT License."
            VALUE "OriginalFilename", "${layout.dll}.dll"
            VALUE "ProductName",      "${layout.name}"
            VALUE "ProductVersion",   "${PROJECT.version}"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x0000, 0x04B0
    END
END

STRINGTABLE
LANGUAGE LANG_NEUTRAL, SUBLANG_NEUTRAL
BEGIN
    1000 "${layout.name}"
    ${LAYOUT_DISPLAY_NAME_ID} "${layout.name}"
    1200 "en-US"
END
`;
}
