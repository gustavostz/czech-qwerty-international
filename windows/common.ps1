# Shared by install.ps1 and uninstall.ps1.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LayoutsKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Keyboard Layouts'
# Layouts are filed under English (United States), like US-International.
$LayoutLanguage = '0409'
# String resource in the DLLs that holds the layout's display name.
$DisplayNameResource = 1100

$Layouts = @(
    [pscustomobject]@{ Key = 'Standard'; File = 'kbdczqi.dll'; Name = 'Czech QWERTY International' }
    [pscustomobject]@{ Key = 'Programmer'; File = 'kbdczqip.dll'; Name = 'Czech QWERTY International (Programmer)' }
)

Add-Type -Namespace CzechQwertyInternational -Name Native -MemberDefinition @'
[DllImport("input.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool InstallLayoutOrTip(string psz, uint dwFlags);

[DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, uint dwFlags);
'@

$ILOT_UNINSTALL = 0x1
$MOVEFILE_DELAY_UNTIL_REBOOT = 0x4

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Runs a script elevated (UAC prompt) and waits for it.
function Invoke-Elevated([string] $Script, [string[]] $Arguments) {
    $powershell = (Get-Process -Id $PID).Path
    $argumentList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$Script`"") + $Arguments
    $process = Start-Process -FilePath $powershell -ArgumentList $argumentList -Verb RunAs -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "The administrator step failed (exit code $($process.ExitCode))." }
}

# Re-runs the current script in 64-bit PowerShell when started from a 32-bit one,
# so that System32 is the real 64-bit system folder.
function Assert-NativeProcess([string] $Script, [hashtable] $BoundParameters) {
    if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) {
        $native = Join-Path $env:windir 'Sysnative\WindowsPowerShell\v1.0\powershell.exe'
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Script)
        foreach ($entry in $BoundParameters.GetEnumerator()) {
            if ($entry.Value -is [switch]) { if ($entry.Value) { $arguments += "-$($entry.Key)" } }
            else { $arguments += "-$($entry.Key)", $entry.Value }
        }
        & $native @arguments
        exit $LASTEXITCODE
    }
}

# Native processor architecture: AMD64, ARM64 or x86.
function Get-NativeArchitecture {
    (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment').PROCESSOR_ARCHITECTURE
}

# Registry id (KLID) under which a layout DLL is registered, or $null.
function Get-LayoutKlid([string] $File) {
    $key = Get-ChildItem $LayoutsKey | Where-Object { $_.GetValue('Layout File') -eq $File } | Select-Object -First 1
    if ($key) { $key.PSChildName } else { $null }
}

# Deletes a file, or moves it aside and deletes it on the next restart if it
# is in use (a keyboard layout that is loaded cannot be deleted).
function Remove-LayoutFile([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        Remove-Item -LiteralPath $Path -Force
    } catch {
        $aside = "$Path.$([guid]::NewGuid().ToString('N')).old"
        Move-Item -LiteralPath $Path -Destination $aside -Force
        [void][CzechQwertyInternational.Native]::MoveFileEx($aside, $null, $MOVEFILE_DELAY_UNTIL_REBOOT)
        Write-Host "  $Path was in use; the old copy will be deleted when you restart."
    }
}

# Folders that receive a layout DLL on this machine: system folder -> build folder.
function Get-SystemFolders {
    $system32 = Join-Path $env:windir 'System32'
    $sysWow64 = Join-Path $env:windir 'SysWOW64'
    switch (Get-NativeArchitecture) {
        'AMD64' { [ordered]@{ $system32 = 'amd64'; $sysWow64 = 'wow64' } }
        'ARM64' { [ordered]@{ $system32 = 'arm64'; $sysWow64 = 'wow64' } }
        'x86' { [ordered]@{ $system32 = 'x86' } }
        default { throw "Unsupported processor architecture: $_" }
    }
}

# Language profile string for InstallLayoutOrTip: "<language id>:<KLID>".
function Get-InputProfile([string] $Klid, [string] $LanguageTag) {
    $lcid = [Globalization.CultureInfo]::GetCultureInfo($LanguageTag).LCID
    # Languages without a numeric id (LOCALE_CUSTOM_UNSPECIFIED) fall back to English (United States).
    if ($lcid -eq 0x1000) { $lcid = 0x0409 }
    '{0:x4}:{1}' -f $lcid, $Klid
}
