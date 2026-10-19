/**
 * Builds the Windows keyboard layout DLLs with MSVC into an installable
 * package folder:
 *
 *   build/windows/amd64/<dll>.dll   64-bit Windows (System32)
 *   build/windows/wow64/<dll>.dll   32-bit apps on 64-bit Windows (SysWOW64)
 *   build/windows/x86/<dll>.dll     32-bit Windows (System32)
 *   build/windows/arm64/<dll>.dll   Windows on ARM (System32), when the MSVC ARM64 tools are installed
 *   build/windows/*                 the installer scripts from windows/
 *
 * The generated C sources go to build/src.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { windowsModuleDefinition, windowsResource, windowsSource } from "../src/generators/windows";
import { LAYOUTS } from "../src/layout";

const ROOT = resolve(import.meta.dir, "..");
const SOURCES = join(ROOT, "build", "src");
const PACKAGE = join(ROOT, "build", "windows");

interface Target {
  dir: string;
  /** vcvarsall.bat argument (host_target). */
  vcvars: string;
  defines: string[];
  /** Visual Studio component that provides the compiler. */
  component: string;
}

const X86_TOOLS = "Microsoft.VisualStudio.Component.VC.Tools.x86.x64";
const TARGETS: Target[] = [
  { dir: "amd64", vcvars: "x64", defines: [], component: X86_TOOLS },
  // 32-bit DLL whose table pointers are 64-bit (kbd.h: KBD_LONG_POINTER = __ptr64).
  { dir: "wow64", vcvars: "x64_x86", defines: ["BUILD_WOW6432"], component: X86_TOOLS },
  { dir: "x86", vcvars: "x64_x86", defines: [], component: X86_TOOLS },
  { dir: "arm64", vcvars: "x64_arm64", defines: [], component: "Microsoft.VisualStudio.Component.VC.Tools.ARM64" },
];

// Same flags as Microsoft's kbdus sample: no CRT, no entry point, and every
// table in one .data section, which is the section Windows reads them from.
const CL_FLAGS = "/nologo /c /O1 /GS- /Zl /W4 /WX /DUNICODE /D_UNICODE";
const LINK_FLAGS = [
  "/nologo /DLL /NOENTRY /NODEFAULTLIB /SUBSYSTEM:NATIVE /RELEASE",
  "/MERGE:.edata=.data /MERGE:.rdata=.data /MERGE:.text=.data /MERGE:.bss=.data",
  "/SECTION:.data,re /IGNORE:4254",
].join(" ");

function vsInstallation(component: string): string | null {
  const programFiles = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const vswhere = join(programFiles, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!existsSync(vswhere)) return null;
  const args = ["-latest", "-products", "*", "-requires", component, "-property", "installationPath"];
  const result = Bun.spawnSync([vswhere, ...args]);
  return result.stdout.toString().trim().split(/\r?\n/)[0] || null;
}

function run(batch: string[], cwd: string): void {
  const file = join(cwd, "build.bat");
  writeFileSync(file, ["@echo off", ...batch, ""].join("\r\n"));
  const result = Bun.spawnSync(["cmd.exe", "/d", "/c", file], { cwd, stdout: "pipe", stderr: "pipe" });
  rmSync(file);
  if (result.exitCode !== 0) {
    throw new Error(`Build failed in ${cwd}:\n${result.stdout.toString()}${result.stderr.toString()}`);
  }
}

if (process.platform !== "win32") {
  console.error("The Windows layout DLLs can only be built on Windows.");
  process.exit(1);
}

rmSync(SOURCES, { recursive: true, force: true });
rmSync(PACKAGE, { recursive: true, force: true });
mkdirSync(SOURCES, { recursive: true });
for (const layout of LAYOUTS) {
  writeFileSync(join(SOURCES, `${layout.dll}.c`), windowsSource(layout));
  writeFileSync(join(SOURCES, `${layout.dll}.def`), windowsModuleDefinition(layout));
  writeFileSync(join(SOURCES, `${layout.dll}.rc`), windowsResource(layout));
}

const built: string[] = [];
for (const target of TARGETS) {
  const vs = vsInstallation(target.component);
  if (!vs) {
    // Release builds (CI) must include every processor.
    if (process.env.CI) throw new Error(`Visual Studio component ${target.component} is required for ${target.dir}`);
    console.warn(`skip ${target.dir}: Visual Studio component ${target.component} is not installed`);
    continue;
  }
  const dir = join(PACKAGE, target.dir);
  mkdirSync(dir, { recursive: true });
  const defines = target.defines.map((d) => ` /D${d}`).join("");
  const steps = LAYOUTS.flatMap(({ dll }) => {
    const src = join(SOURCES, dll);
    return [
      `cl ${CL_FLAGS}${defines} /Fo"${dll}.obj" "${src}.c" || exit /b 1`,
      `rc /nologo /fo "${dll}.res" "${src}.rc" || exit /b 1`,
      `link ${LINK_FLAGS} /DEF:"${src}.def" /OUT:"${dll}.dll" "${dll}.obj" "${dll}.res" || exit /b 1`,
      `del "${dll}.obj" "${dll}.res" "${dll}.exp" "${dll}.lib"`,
    ];
  });
  const vcvarsall = join(vs, "VC", "Auxiliary", "Build", "vcvarsall.bat");
  run([`call "${vcvarsall}" ${target.vcvars} >nul || exit /b 1`, ...steps], dir);
  built.push(target.dir);
}

for (const file of readdirSync(join(ROOT, "windows"))) {
  cpSync(join(ROOT, "windows", file), join(PACKAGE, file));
}

console.log(`Built ${LAYOUTS.map((l) => `${l.dll}.dll`).join(", ")} for ${built.join(", ")} in ${PACKAGE}`);
