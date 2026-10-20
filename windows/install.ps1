<#
.SYNOPSIS
    Installs the Czech QWERTY International keyboard layouts.

.DESCRIPTION
    Copies the layout DLLs into the Windows system folders and registers both
    layouts (this step asks for administrator rights), then adds the chosen
    layouts to your keyboard list. Sign out and back in (or restart), then
    switch keyboards with Win + Space.

    Running it again updates an existing installation.

.PARAMETER Enable
    Layouts to add to your keyboard list: Standard (default), Programmer, or Both.
    Both are always installed, so you can also add one later in
    Settings > Time & language > Language & region.

.PARAMETER MachineOnly
    Only copy and register the DLLs (used for the elevated step).

.EXAMPLE
    .\install.ps1 -Enable Both
#>
[CmdletBinding()]
param(
    [ValidateSet('Standard', 'Programmer', 'Both')]
    [string] $Enable = 'Standard',
    [switch] $MachineOnly
)

. (Join-Path $PSScriptRoot 'common.ps1')
Assert-NativeProcess $PSCommandPath $PSBoundParameters

function Install-Machine {
    $folders = Get-SystemFolders
    foreach ($build in $folders.Values) {
        foreach ($layout in $Layouts) {
            $source = Join-Path $PSScriptRoot "$build\$($layout.File)"
            if (-not (Test-Path -LiteralPath $source)) {
                throw "This package has no $build build of $($layout.File) for your processor."
            }
        }
    }

    $usedIds = @(Get-ChildItem $LayoutsKey | ForEach-Object { $_.GetValue('Layout Id') } | Where-Object { $_ })

    foreach ($layout in $Layouts) {
        Write-Host "Installing $($layout.Name)"
        foreach ($folder in $folders.Keys) {
            $target = Join-Path $folder $layout.File
            Remove-LayoutFile $target
            Copy-Item -LiteralPath (Join-Path $PSScriptRoot "$($folders[$folder])\$($layout.File)") -Destination $target
        }

        $klid = Get-LayoutKlid $layout.File
        if (-not $klid) {
            # Custom layouts use ids a000xxxx, a001xxxx, ... (as Microsoft's layout creator does).
            $klid = 0xa000..0xafff | ForEach-Object { '{0:x4}{1}' -f $_, $LayoutLanguage } |
                Where-Object { -not (Test-Path "$LayoutsKey\$_") } | Select-Object -First 1
        }
        $key = "$LayoutsKey\$klid"

        # "Layout Id" must be unique among all layouts, or Windows lists the layout but never loads it.
        $layoutId = if (Test-Path $key) { (Get-Item $key).GetValue('Layout Id') }
        if (-not $layoutId) {
            $highest = @($usedIds | ForEach-Object { [Convert]::ToInt32($_, 16) }) + 0xbf | Measure-Object -Maximum
            $layoutId = '{0:x4}' -f ([int]$highest.Maximum + 1)
            $usedIds += $layoutId
        }

        # Everything is computed before the key is created, so a failure cannot leave a half-registered layout.
        if (-not (Test-Path $key)) { New-Item -Path $key | Out-Null }
        Set-ItemProperty -Path $key -Name 'Layout File' -Value $layout.File
        Set-ItemProperty -Path $key -Name 'Layout Text' -Value $layout.Name
        Set-ItemProperty -Path $key -Name 'Layout Display Name' -Value "@%SystemRoot%\system32\$($layout.File),-$DisplayNameResource"
        Set-ItemProperty -Path $key -Name 'Layout Id' -Value $layoutId
        Write-Host "  registered as $klid"
    }
}

function Enable-ForUser {
    # Add the layouts to English (United States) if you use it, else to your first language.
    $languages = Get-WinUserLanguageList
    $language = @($languages | Where-Object LanguageTag -eq 'en-US')[0]
    if (-not $language) { $language = $languages[0] }

    foreach ($layout in $Layouts | Where-Object { $Enable -in 'Both', $_.Key }) {
        $klid = Get-LayoutKlid $layout.File
        if (-not $klid) { throw "$($layout.Name) is not registered." }
        $inputProfile = Get-InputProfile $klid $language.LanguageTag
        if (-not [CzechQwertyInternational.Native]::InstallLayoutOrTip($inputProfile, 0)) {
            throw "Windows could not add $($layout.Name) to your keyboards."
        }
        Write-Host "Added $($layout.Name) to $($language.LocalizedName)."
    }
}

try {
    if (Test-Administrator) {
        Install-Machine
    } else {
        Write-Host 'Asking for administrator rights to install the layout files...'
        Invoke-Elevated $PSCommandPath @('-MachineOnly')
    }
    if (-not $MachineOnly) {
        Enable-ForUser
        Write-Host ''
        # Until the next sign-in, Windows has not loaded the new layout's id, and choosing the layout restarts Explorer.
        Write-Host 'Done. Now sign out of Windows and back in, or restart the PC (locking the screen is not enough).' -ForegroundColor Yellow
        Write-Host 'Then press Win + Space to switch keyboards.'
    }
} catch {
    Write-Host ''
    Write-Host "Installation failed: $_" -ForegroundColor Red
    if ($MachineOnly) { Read-Host 'Press Enter to close' }
    exit 1
}
