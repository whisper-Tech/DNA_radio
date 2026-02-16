@echo off
setlocal
set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launch_dna_radio.ps1"
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo Launcher failed with exit code %EXITCODE%.
  echo Check:
  echo   %SCRIPT_DIR%launch_log.txt
  echo   %TEMP%\dna_radio_server.log
  pause
)

exit /b %EXITCODE%

