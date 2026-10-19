/**
 * XKB symbols file for Linux (X11 and Wayland), with one variant per layout.
 * Right Alt is AltGr (level 3). Dead keys compose through the system's
 * Compose tables, as on the standard us(intl) layout.
 */
import { codeUnit, hex4, isAlphanumeric } from "../chars";
import { PHYSICAL_KEYS } from "../keys";
import { type Accent, type Cell, LEVELS, type Layout, isDead } from "../model";
import { GENERATED_NOTICE, PROJECT } from "../project";

/** File name of the symbols file, and the XKB layout name. */
export const XKB_LAYOUT = "czqi";

const DEAD_KEYSYMS: Record<Accent, string> = {
  acute: "dead_acute",
  diaeresis: "dead_diaeresis",
  grave: "dead_grave",
  tilde: "dead_tilde",
  circumflex: "dead_circumflex",
};

const ASCII_KEYSYMS: Record<string, string> = {
  " ": "space", "!": "exclam", '"': "quotedbl", "#": "numbersign", $: "dollar", "%": "percent",
  "&": "ampersand", "'": "apostrophe", "(": "parenleft", ")": "parenright", "*": "asterisk",
  "+": "plus", ",": "comma", "-": "minus", ".": "period", "/": "slash", ":": "colon",
  ";": "semicolon", "<": "less", "=": "equal", ">": "greater", "?": "question", "@": "at",
  "[": "bracketleft", "\\": "backslash", "]": "bracketright", "^": "asciicircum",
  _: "underscore", "`": "grave", "{": "braceleft", "|": "bar", "}": "braceright", "~": "asciitilde",
};

function keysym(cell: Cell): string {
  if (cell === null) return "NoSymbol";
  if (isDead(cell)) return DEAD_KEYSYMS[cell.dead];
  if (isAlphanumeric(cell)) return cell;
  return ASCII_KEYSYMS[cell] ?? `U${hex4(codeUnit(cell)).toUpperCase()}`;
}

function symbols(layout: Layout, isDefault: boolean): string {
  const keys = PHYSICAL_KEYS.map((key) => {
    const syms = LEVELS.map((level) => keysym(layout.keys[key.id][level]));
    while (syms.length > 1 && syms.at(-1) === "NoSymbol") syms.pop();
    return `    key <${key.xkb}> { [ ${syms.join(", ")} ] };`;
  });
  return [
    `${isDefault ? "default " : ""}partial alphanumeric_keys modifier_keys`,
    `xkb_symbols "${layout.variant}" {`,
    `    name[Group1] = "${layout.name}";`,
    "",
    ...keys,
    "",
    '    include "level3(ralt_switch)"',
    "};",
  ].join("\n");
}

/** One symbols file with a variant per layout; the first layout is the default variant. */
export function xkb(layouts: readonly Layout[]): string {
  return `// Czech QWERTY International keyboard layouts for XKB (Linux).
// ${GENERATED_NOTICE}
// ${PROJECT.homepage}
//
// Variants: ${layouts.map((l) => `${XKB_LAYOUT}(${l.variant}) = ${l.name}`).join("; ")}

${layouts.map((layout, i) => symbols(layout, i === 0)).join("\n\n")}
`;
}
