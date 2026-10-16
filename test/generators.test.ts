import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { keylayout } from "../src/generators/keylayout";
import { klc, klcBytes } from "../src/generators/klc";
import { LAYOUT_DISPLAY_NAME_ID } from "../src/generators/windows";
import { xkb } from "../src/generators/xkb";
import { CZECH_QWERTY_INTERNATIONAL, CZECH_QWERTY_INTERNATIONAL_PROGRAMMER, LAYOUTS } from "../src/layout";
import { generatedFiles } from "../src/outputs";

const ROOT = join(import.meta.dir, "..");

test("committed platform files and diagrams are up to date (run `bun run generate`)", () => {
  for (const [path, content] of generatedFiles()) {
    const committed = readFileSync(join(ROOT, path));
    expect({ path, upToDate: committed.equals(Buffer.from(content)) }).toEqual({ path, upToDate: true });
  }
});

describe("KLC (Microsoft Keyboard Layout Creator)", () => {
  const text = klc(CZECH_QWERTY_INTERNATIONAL);

  test("is UTF-16 LE with a byte order mark and CRLF line endings", () => {
    const bytes = klcBytes(text);
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    const decoded = bytes.toString("utf16le");
    expect(decoded).toContain("ENDKBD\r\n");
    expect(decoded.replaceAll("\r\n", "")).not.toContain("\n");
  });

  test("puts č on AltGr + C, with Caps Lock on both layers, and ' as a dead key", () => {
    expect(text).toMatch(/^2e\tC +\t5\tc\tC\t-1\t-1\t010d\t010c\t/m);
    expect(text).toMatch(/^28\tOEM_7 +\t0\t0027@\t0022@\t-1\t-1\t00b4\t00a8\t/m);
    expect(text).toContain("DEADKEY\t0027\n\n0061\t00e1\t// a -> á");
  });
});

describe("XKB (Linux)", () => {
  const text = xkb(LAYOUTS);

  test("defines both variants with AltGr letters and dead keys", () => {
    expect(text).toContain('default partial alphanumeric_keys modifier_keys\nxkb_symbols "basic" {');
    expect(text).toContain('xkb_symbols "programmer" {');
    expect(text).toContain("key <AB03> { [ c, C, U010D, U010C ] };");
    expect(text).toContain("key <AC11> { [ dead_acute, dead_diaeresis, U00B4, U00A8 ] };");
    expect(text).toContain("key <AC11> { [ apostrophe, quotedbl, dead_acute, dead_diaeresis ] };");
    expect(text.match(/include "level3\(ralt_switch\)"/g)).toHaveLength(2);
  });
});

describe.each(LAYOUTS.map((layout) => [layout.name, layout] as const))("macOS keylayout: %s", (_, layout) => {
  const text = keylayout(layout);

  test("is well-formed: balanced elements and escaped markup", () => {
    for (const tag of ["keyboard", "layouts", "modifierMap", "keyMapSelect", "keyMapSet", "keyMap", "actions", "action", "terminators"]) {
      const opened = text.match(new RegExp(`<${tag}[ >]`, "g"))?.length ?? 0;
      expect({ tag, closed: text.match(new RegExp(`</${tag}>`, "g"))?.length ?? 0 }).toEqual({ tag, closed: opened });
    }
    expect(text).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#x[0-9A-F]+;)/);
  });

  test("every action a key uses is defined, and every dead state has a terminator", () => {
    const defined = new Set([...text.matchAll(/<action id="([^"]+)"/g)].map((m) => m[1]));
    for (const [, id] of text.matchAll(/<key code="\d+" action="([^"]+)"/g)) expect(defined).toContain(id);
    for (const [, state] of text.matchAll(/next="([^"]+)"/g)) expect(text).toContain(`<when state="${state}" output=`);
  });

  test("types č with Option + C and á with the acute dead key then A", () => {
    expect(text).toMatch(/<keyMap index="3">[^]*?<key code="8" output="č"\/>/);
    expect(text).toMatch(/<action id="a">[^]*?<when state="acute" output="á"\/>[^]*?<\/action>/);
  });
});

test("the macOS Programmer layout keeps ' as a plain key and the acute accent on Option + '", () => {
  const text = keylayout(CZECH_QWERTY_INTERNATIONAL_PROGRAMMER);
  expect(text).toMatch(/<keyMap index="0">[^]*?<key code="39" output="&apos;"\/>/);
  expect(text).toMatch(/<keyMap index="3">[^]*?<key code="39" action="dead-acute"\/>/);
});

test("the Windows installer knows every layout", () => {
  const script = readFileSync(join(ROOT, "windows", "common.ps1"), "utf8");
  for (const layout of LAYOUTS) expect(script).toContain(`File = '${layout.dll}.dll'; Name = '${layout.name}'`);
  expect(script).toContain(`$DisplayNameResource = ${LAYOUT_DISPLAY_NAME_ID}`);
});
