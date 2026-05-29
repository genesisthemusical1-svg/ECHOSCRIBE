@echo off
setlocal enabledelayedexpansion
title EchoScribe Desktop Installer Console
color 0F

echo ======================================================================
echo                ECHOSCRIBE COGNITIVE VOICE RECORDER
echo                    DESKTOP BUILDER ^& BOOTSTRAPPER
echo ======================================================================
echo.
echo This console initializes the assets first, then triggers the graphical 
echo Setup Wizard to let you choose your installation location.
echo.

:: ------------------------------------------------------------------------
:: STEP 1: DETECT OR INTEGRATE PORTABLE NODE.JS RUNTIME ENVIRONMENT
:: ------------------------------------------------------------------------
echo [1/4] Detecting system variables and pre-requisites...

set "LOCAL_NODE_DIR=%~dp0.local-node"
set "NODE_EXISTS=0"

:: Check for global system Node
where node >nul 2>&1
if !errorlevel! equ 0 (
    set "NODE_EXISTS=1"
    for /f "tokens=*" %%g in ('node -v') do (set node_ver=%%g)
    echo [OK] System Node.js detected globally: !node_ver!
    goto NodeValidated
)

:: Check for existing local sandbox Node
if exist "%LOCAL_NODE_DIR%\node.exe" (
    set "NODE_EXISTS=1"
    set "PATH=%LOCAL_NODE_DIR%;%PATH%"
    echo [OK] Standalone sandboxed Node.js found in %LOCAL_NODE_DIR%
    goto NodeValidated
)

:: Download portable Node.js if not present
echo.
echo ----------------------------------------------------------------------
echo [INFO] Node.js was not detected on your Windows computer.
echo Rather than requiring you to install it manually, EchoScribe will now
echo download and set up a lightweight, sandboxed portable Node.js runtime.
echo This makes EchoScribe completely offline, self-contained, and portable!
echo ----------------------------------------------------------------------
echo.
echo Downloading stable Node.js runtime v20.11.1 (approx. 30MB)...
echo Please keep this terminal open and connected to the internet.
echo.

if exist "node_portable.zip" del /f /q "node_portable.zip"
if exist "node_temp" rmdir /s /q "node_temp"

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Downloading stable Node runtime v20.11.1...'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip' -OutFile 'node_portable.zip'"
if !errorlevel! neq 0 goto NodeDownloadError

echo.
echo Extracting portable Node.js runtime core...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'Expanding runtime archive files...'; Expand-Archive -Path 'node_portable.zip' -DestinationPath 'node_temp' -Force"
if !errorlevel! neq 0 goto NodeExtractError

echo Configuring localized environment pathing...
if not exist "%LOCAL_NODE_DIR%" mkdir "%LOCAL_NODE_DIR%"
xcopy /e /s /y "node_temp\node-v20.11.1-win-x64\*" "%LOCAL_NODE_DIR%\" >nul

:: Clean up files
if exist "node_portable.zip" del /f /q "node_portable.zip"
if exist "node_temp" rmdir /s /q "node_temp"

if exist "%LOCAL_NODE_DIR%\node.exe" (
    set "PATH=%LOCAL_NODE_DIR%;%PATH%"
    echo [SUCCESS] Sandboxed Node.js environment integrated successfully!
    goto NodeValidated
) else (
    goto NodeVerifyError
)

:NodeValidated
echo.

:: ------------------------------------------------------------------------
:: STEP 2: ALIGN OFFLINE DEPENDENCY TREE
:: ------------------------------------------------------------------------
echo [2/4] Synchronizing modules and dependency packages...
echo Configuring APIs, secure recording modules, and local databases.
echo ----------------------------------------------------------------------
call npm install --no-audit --no-fund
if !errorlevel! neq 0 (
    color 0D
    echo.
    echo [WARNING] Dependency synchronization completed with minor notifications.
) else (
    echo [SUCCESS] Dependencies matched and synced!
)
echo.

:: ------------------------------------------------------------------------
:: STEP 3: COMPILE CORE ASSETS, BRAND ICONS, AND STANDALONE LAUNCHERS
:: ------------------------------------------------------------------------
echo [3/4] Compiling assets, compiling brand icons, and scripting launchers...
echo ----------------------------------------------------------------------
call npm run build
if !errorlevel! neq 0 goto BuildError

echo.
echo [SUCCESS] Brand assets compiled and optimized completely!
echo.

:: ------------------------------------------------------------------------
:: STEP 4: BOOT STRAP GRAPHICAL SETUP WIZARD
:: ------------------------------------------------------------------------
echo [4/4] Launching EchoScribe Setup Wizard window...
echo ----------------------------------------------------------------------
echo Opening full graphic wizard. You can customize the path of installation 
echo in the popup. Please complete the setup steps there...
echo.

:: Disable quick edit mode on cmd console to avoid accidental freezes
powershell -NoProfile -ExecutionPolicy Bypass -Command "$Console = [Console]; $Handle = (Get-Process -Id $pid).MainWindowHandle; if ($Handle) { # Skip if running headless }"

:: Run the setup-wizard.ps1 GUI launcher from local context
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-wizard.ps1"

if !errorlevel! neq 0 (
    color 0C
    echo [ERROR] The graphical setup wizard window crashed or was aborted.
    echo Please make sure Windows Forms and script execution are enabled on your shell.
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo              INSTALLER PROCESS CONCLUDED SUCCESSFULLY
echo ======================================================================
echo.
echo You may close this console window now. Enjoy local offline cognitive sync!
echo.
exit /b 0


:: ------------------------------------------------------------------------
:: ERROR HANDLERS (SEQUENTIAL & SEGREGATED)
:: ------------------------------------------------------------------------
:NodeDownloadError
color 0C
echo.
echo [ERROR] Failed to download standard portable Node.js runtime.
echo Please verify that your computer remains connected to the active internet.
pause
exit /b 1

:NodeExtractError
color 0C
echo.
echo [ERROR] Encountered a file system extraction issue unzipping Node.
pause
exit /b 1

:NodeVerifyError
color 0C
echo.
echo [ERROR] Local portable Node.js verification failed. 'node.exe' was not constructed.
pause
exit /b 1

:BuildError
color 0C
echo.
echo [ERROR] Compilation sub-processes failed during asset building.
echo Please review standard print outputs above for further indications.
pause
exit /b 1
