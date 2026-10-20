Czech QWERTY International for Windows
https://github.com/gustavostz/czech-qwerty-international

Install:   double-click install.cmd and accept the administrator prompt.
           Then sign out of Windows and back in, or restart the PC
           (locking the screen is not enough), and switch keyboards
           with Win + Space. Windows only picks up a new keyboard when
           you sign in: before that, choosing it reloads the taskbar
           and puts you back on your previous keyboard.
Uninstall: double-click uninstall.cmd.

Both layouts are installed; install.cmd adds "Czech QWERTY International"
to your keyboards. To also add the Programmer variant (where ' and " are
plain keys), run:  powershell -ExecutionPolicy Bypass -File install.ps1 -Enable Both
or add it in Settings > Time & language > Language & region.

  ' then a e i o u y        á é í ó ú ý
  AltGr + c d e n r s t z   č ď ě ň ř š ť ž
  AltGr + u                 ů
  add Shift for capitals    AltGr is the right Alt key

If Windows SmartScreen warns about install.cmd, choose "More info" then
"Run anyway" (the scripts are plain text; read them first if you like).
