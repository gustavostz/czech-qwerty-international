<#
.SYNOPSIS
    Removes the Czech QWERTY International keyboard layouts.

.DESCRIPTION
    Removes the layouts from your keyboard list, then unregisters them and
    deletes the DLLs (this step asks for administrator rights). Other users
    who added the layouts should remove them in Settings first.

.PARAMETER MachineOnly
    Only unregister and delete the DLLs (used for the elevated step).
#>
[CmdletBinding()]
param(
    [switch] $MachineOnly
)

. (Join-Path $PSScriptRoot 'common.ps1')
Assert-NativeProcess $PSCommandPath $PSBoundParameters

function Disable-ForUser {
    foreach ($layout in $Layouts) {
        $klid = Get-LayoutKlid $layout.File
        if (-not $klid) { continue }
        foreach ($language in Get-WinUserLanguageList) {
            foreach ($tip in @($language.InputMethodTips | Where-Object { $_ -like "*:$klid" })) {
                [void][CzechQwertyInternational.Native]::InstallLayoutOrTip($tip, $ILOT_UNINSTALL)
                Write-Host "Removed $($layout.Name) from $($language.LocalizedName)."
            }
        }
    }
}

function Uninstall-Machine {
    foreach ($layout in $Layouts) {
        $klid = Get-LayoutKlid $layout.File
        if ($klid) {
            Remove-Item -Path "$LayoutsKey\$klid" -Recurse
            Write-Host "Unregistered $($layout.Name) ($klid)."
        }
        foreach ($folder in (Get-SystemFolders).Keys) {
            Remove-LayoutFile (Join-Path $folder $layout.File)
        }
    }
}

try {
    if (-not $MachineOnly) { Disable-ForUser }
    if (Test-Administrator) {
        Uninstall-Machine
    } else {
        Write-Host 'Asking for administrator rights to remove the layout files...'
        Invoke-Elevated $PSCommandPath @('-MachineOnly')
    }
    if (-not $MachineOnly) { Write-Host ''; Write-Host 'Done.' }
} catch {
    Write-Host ''
    Write-Host "Uninstall failed: $_" -ForegroundColor Red
    if ($MachineOnly) { Read-Host 'Press Enter to close' }
    exit 1
}
