/** Every generated file that is committed to the repository, by path. */
import { keylayout, keylayoutFileName } from "./generators/keylayout";
import { klc, klcBytes } from "./generators/klc";
import { svg } from "./generators/svg";
import { XKB_LAYOUT, xkb } from "./generators/xkb";
import { LAYOUTS } from "./layout";

export function generatedFiles(): Map<string, string | Buffer> {
  const files = new Map<string, string | Buffer>();
  for (const layout of LAYOUTS) {
    files.set(`platforms/windows/${layout.dll}.klc`, klcBytes(klc(layout)));
    files.set(`platforms/macos/${keylayoutFileName(layout)}`, keylayout(layout));
    files.set(`docs/${layout.id}.svg`, svg(layout));
  }
  // An XKB include directory: copy it to ~/.config/xkb or /usr/share/X11/xkb.
  files.set(`platforms/linux/symbols/${XKB_LAYOUT}`, xkb(LAYOUTS));
  return files;
}
