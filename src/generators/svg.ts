/** Keyboard diagram (SVG) of a layout, for the README and release notes. */
import { type KeyId, PHYSICAL_KEYS } from "../keys";
import { CZECH_LETTERS } from "../layout";
import { type Cell, type Layout, deadChar, isCasePair, isDead } from "../model";

const UNIT = 62;
const GAP = 6;
const MARGIN = 24;
const TOP = 76;

type Slot = KeyId | { label: string; width: number; accent?: boolean };

/** ANSI rows; the extra ISO key (IntlBackslash) types the same as Backslash and is left out. */
const ROWS: Slot[][] = [
  [...ids(0), { label: "Backspace", width: 2 }],
  [{ label: "Tab", width: 1.5 }, ...ids(1)],
  [{ label: "Caps Lock", width: 1.75 }, ...ids(2), { label: "Enter", width: 2.25 }],
  [{ label: "Shift", width: 2.25 }, ...ids(3).filter((id) => id !== "IntlBackslash"), { label: "Shift", width: 2.75 }],
  [
    { label: "Ctrl", width: 1.25 },
    { label: "Win", width: 1.25 },
    { label: "Alt", width: 1.25 },
    "Space",
    { label: "AltGr", width: 1.25, accent: true },
    { label: "Win", width: 1.25 },
    { label: "Menu", width: 1.25 },
    { label: "Ctrl", width: 1.25 },
  ],
];

function ids(row: number): KeyId[] {
  return PHYSICAL_KEYS.filter((k) => k.row === row).map((k) => k.id);
}

function width(slot: Slot): number {
  if (typeof slot !== "string") return slot.width;
  if (slot === "Backslash") return 1.5;
  if (slot === "Space") return 6.25;
  return 1;
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CZECH = new Set<string>(Object.values(CZECH_LETTERS).flat());

function label(layout: Layout, cell: Cell): { text: string; dead: boolean } | null {
  if (cell === null || cell === " ") return null;
  if (isDead(cell)) return { text: deadChar(layout, cell.dead), dead: true };
  return { text: cell, dead: false };
}

/** Czech-letter keys and AltGr are highlighted; keys that type nothing are shaded. */
function keyClass(layout: Layout, slot: Slot): string {
  if (typeof slot === "string") return CZECH.has(String(layout.keys[slot].altgr)) ? "key czech-key" : "key";
  return slot.accent ? "key accent-key" : "key mod";
}

function text(x: number, y: number, size: number, cls: string, value: string, anchor = "start"): string {
  return `<text x="${x}" y="${y}" font-size="${size}" class="${cls}" text-anchor="${anchor}">${escape(value)}</text>`;
}

function keyContent(layout: Layout, id: KeyId, x: number, y: number, w: number): string[] {
  const levels = layout.keys[id];
  const h = UNIT - GAP;
  const parts: string[] = [];
  const left = (cell: Cell, top: boolean, size: number) => {
    const l = label(layout, cell);
    if (l) parts.push(text(x + 10, y + (top ? 23 : h - 11), size, l.dead ? "dead" : "main", l.text));
  };
  const right = (cell: Cell, top: boolean) => {
    const l = label(layout, cell);
    if (!l) return;
    const cls = l.dead ? "dead" : CZECH.has(l.text) ? "czech" : "altgr";
    parts.push(text(x + w - 10, y + (top ? 23 : h - 11), 17, cls, l.text, "end"));
  };
  // Letters show only one case, as printed on keyboards: the capital on the
  // left and the AltGr letter on the right; Shift gives the other case.
  if (isCasePair(levels.base, levels.shift)) {
    left(levels.shift, true, 22);
  } else {
    left(levels.shift, true, 17);
    left(levels.base, false, 17);
  }
  if (!isCasePair(levels.altgr, levels.shiftAltgr)) right(levels.shiftAltgr, true);
  right(levels.altgr, false);
  return parts;
}

export function svg(layout: Layout): string {
  const totalWidth = 15 * UNIT - GAP + 2 * MARGIN;
  const keyboardHeight = ROWS.length * UNIT - GAP;
  const legendTop = TOP + keyboardHeight + 30;
  const totalHeight = legendTop + 54;
  const body: string[] = [];

  ROWS.forEach((row, r) => {
    let x = MARGIN;
    const y = TOP + r * UNIT;
    for (const slot of row) {
      const w = width(slot) * UNIT - GAP;
      body.push(`<rect x="${x}" y="${y}" width="${w}" height="${UNIT - GAP}" rx="7" class="${keyClass(layout, slot)}"/>`);
      if (typeof slot === "string") body.push(...keyContent(layout, slot, x, y, w));
      else body.push(text(x + 10, y + UNIT - GAP - 11, 13, slot.accent ? "accent" : "muted", slot.label));
      x += width(slot) * UNIT;
    }
  });

  const legend = [
    `<rect x="${MARGIN}" y="${legendTop - 16}" width="22" height="22" rx="4" class="key czech-key"/>`,
    text(MARGIN + 11, legendTop, 14, "czech", "č", "middle"),
    text(MARGIN + 32, legendTop, 14, "muted", "AltGr + letter (add Shift for capitals)"),
    `<rect x="${MARGIN + 330}" y="${legendTop - 16}" width="22" height="22" rx="4" class="key"/>`,
    text(MARGIN + 341, legendTop + 1, 17, "dead", "'", "middle"),
    text(MARGIN + 362, legendTop, 14, "muted", "dead key: type it, then the letter (' then a = á, ~ then a = ã)"),
    text(MARGIN, legendTop + 32, 14, "muted", "Left: Shift / normal.  Right: Shift + AltGr / AltGr.  AltGr is the right Alt key."),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" role="img" aria-label="${escape(`${layout.name} keyboard layout`)}">
<style>
  svg { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
  .bg { fill: #ffffff; }
  .key { fill: #f4f4f5; stroke: #d4d4d8; }
  .mod { fill: #e4e4e7; }
  .czech-key { fill: #dbeafe; stroke: #93c5fd; }
  .accent-key { fill: #dbeafe; stroke: #3b82f6; }
  .title { fill: #18181b; font-weight: 600; }
  .main { fill: #18181b; }
  .muted { fill: #52525b; }
  .altgr { fill: #52525b; }
  .czech { fill: #1d4ed8; font-weight: 700; }
  .accent { fill: #1d4ed8; font-weight: 600; }
  .dead { fill: #c2410c; font-weight: 700; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #18181b; }
    .key { fill: #27272a; stroke: #3f3f46; }
    .mod { fill: #1f1f23; }
    .czech-key { fill: #1e3a8a; stroke: #3b82f6; }
    .accent-key { fill: #1e3a8a; stroke: #60a5fa; }
    .title, .main { fill: #fafafa; }
    .muted, .altgr { fill: #a1a1aa; }
    .czech, .accent { fill: #bfdbfe; }
    .dead { fill: #fb923c; }
  }
</style>
<rect width="100%" height="100%" class="bg"/>
${text(MARGIN, 38, 22, "title", layout.name)}
${text(MARGIN, 60, 14, "muted", layout.summary)}
${body.join("\n")}
${legend.join("\n")}
</svg>
`;
}
