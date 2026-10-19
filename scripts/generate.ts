/**
 * Regenerates the committed platform files and diagrams from src/layout:
 *
 *   platforms/windows/*.klc        Microsoft Keyboard Layout Creator sources
 *   platforms/macos/*.keylayout    macOS layouts
 *   platforms/linux/symbols/czqi   XKB symbols (Linux)
 *   docs/*.svg                     keyboard diagrams
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { generatedFiles } from "../src/outputs";

const ROOT = resolve(import.meta.dir, "..");

for (const [path, content] of generatedFiles()) {
  const file = join(ROOT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`wrote ${path}`);
}
