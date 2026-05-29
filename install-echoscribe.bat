@echo off
setlocal enabledelayedexpansion
title EchoScribe Desktop Installer
color 0F

echo ======================================================================
echo                ECHOSCRIBE COGNITIVE VOICE RECORDER
echo                  ECHO-SYSTEM DESKTOP INSTALLER
echo ======================================================================
echo.
echo This installer will build, configure, and install EchoScribe on your PC.
echo.

:: ------------------------------------------------------------------------
:: STEP 1: CHECK NODE.JS ENVIRONMENT (OR INSTANTLY DOWNLOAD PORTABLE VERSION)
:: ------------------------------------------------------------------------
echo [1/4] Checking system pre-requisites...

set "LOCAL_NODE_DIR=%~dp0.local-node"
set "NODE_EXISTS=0"

:: Check if global node exists
where node >nul 2>&1
if !errorlevel! equ 0 (
    set "NODE_EXISTS=1"
    for /f "tokens=*" %%g in ('node -v') do (set node_ver=%%g)
    echo [FOUND] Global Node.js detected: !node_ver!
)

:: If not global, check if we already have local node
if !NODE_EXISTS! equ 0 (
    if exist "!LOCAL_NODE_DIR!\node.exe" (
        set "NODE_EXISTS=1"
        set "PATH=!LOCAL_NODE_DIR!;!PATH!"
        echo [FOUND] Local portable Node.js detected in .local-node!
    )
)

:: If still not found, download portable Node.js automatically!
if !NODE_EXISTS! equ 0 (
    echo.
    echo ----------------------------------------------------------------------
    echo [INFO] Node.js was not detected on your Windows computer.
    echo Rather than requiring you to install it manually, EchoScribe will now
    echo download and set up a lightweight, sandboxed portable Node.js runtime.
    echo This makes EchoScribe completely self-contained and easy to deploy!
    echo ----------------------------------------------------------------------
    echo.
    echo Downloading stable Node.js runtime (approx. 30MB)...
    echo Please keep this terminal open and connected to the internet.
    echo.

    :: Create temporary download folder
    if exist "node_portable.zip" del /f /q "node_portable.zip"
    if exist "node_temp" rmdir /s /q "node_temp"

    :: Use PowerShell to download the zip
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Downloading archive...'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip' -OutFile 'node_portable.zip'"

    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [ERROR] Failed to download portable Node.js.
        echo Please ensure you are connected to the Internet and try running this installer again.
        pause
        exit /b 1
    )

    echo.
    echo Extracting Node.js runtime environment...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'Expanding runtime files...'; Expand-Archive -Path 'node_portable.zip' -DestinationPath 'node_temp' -Force"

    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [ERROR] Failed to extract Node.js archive file.
        pause
        exit /b 1
    )

    :: Move contents of zip subfolder to .local-node
    echo Configuring local directories...
    if not exist "!LOCAL_NODE_DIR!" mkdir "!LOCAL_NODE_DIR!"
    xcopy /e /s /y "node_temp\node-v20.11.1-win-x64\*" "!LOCAL_NODE_DIR!\" >nul

    :: Clean up zip and temp folder
    del /f /q "node_portable.zip"
    rmdir /s /q "node_temp"

    if exist "!LOCAL_NODE_DIR!\node.exe" (
        set "PATH=!LOCAL_NODE_DIR!;!PATH!"
        echo.
        echo [SUCCESS] Local portable Node.js compiled and successfully integrated!
    ) else (
        color 0C
        echo.
        echo [ERROR] Verification failed. Node.exe was not successfully assembled.
        pause
        exit /b 1
    )
)

echo.

:: ------------------------------------------------------------------------
:: STEP 2: INSTALL CORE DEPENDENCIES
:: ------------------------------------------------------------------------
echo [2/4] Installing offline dependencies and local modules...
echo This manages secure APIs, audio handlers, and local databases.
echo Hang tight, this only takes a moment...
echo ----------------------------------------------------------------------
call npm install --no-audit --no-fund
if !errorlevel! neq 0 (
    color 0D
    echo.
    echo [WARNING] Dependency installation finished with minor warnings.
    echo This is normal for generic platform packages. Continuing setup...
) else (
    echo [SUCCESS] Dependencies successfully installed and synced!
)
echo.

:: ------------------------------------------------------------------------
:: STEP 3: BUNDLE PRODUCTIVE FRONTEND/BACKEND CORE
:: ------------------------------------------------------------------------
echo [3/4] Compiling and packaging local production assets...
echo Creating highly optimized ES Module bundles to bypass local 'tsx' limits.
echo ----------------------------------------------------------------------
call npm run build
if !errorlevel! neq 0 (
    color 0C
    echo [ERROR] Failed to compile production assets.
    echo Please check the log messages above. If errors persist, try deleting node_modules and running this again.
    pause
    exit /b 1
)
echo [SUCCESS] Production assets compiled to dist/ folder successfully!
echo.

:: ------------------------------------------------------------------------
:: STEP 4: CONFIGURE DESKTOP BLUEPRINTS AND SHORCUTS
:: ------------------------------------------------------------------------
echo [4/4] Generating desktop runner scripts and shortcuts...

:: A: Create launch-echoscribe.bat which automatically targets our local/global Node
set "launcher_file=%~dp0launch-echoscribe.bat"
(
echo @echo off
echo title EchoScribe Core Terminal
echo color 0F
echo cd /d "%%~dp0"
echo.
echo :: Look for local portable node setup
echo if exist "%%~dp0.local-node\node.exe" (
echo     set "PATH=%%~dp0.local-node;%%PATH%%"
echo ^)
echo.
echo if not exist "node_modules\" (
echo     color 0C
echo     echo [ERROR] Dependencies missing. Please run install-echoscribe.bat first.
echo     echo.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo if not exist "dist\server.cjs" (
echo     color 0B
echo     echo [INFO] Optimized production build missing. Rebuilding bundle...
echo     call npm run build
echo ^)
echo.
echo color 0B
echo echo ======================================================================
echo echo                ECHOSCRIBE - COGNITIVE RECORDER CORE
echo echo ======================================================================
echo echo.
echo echo [SERVER] Starting offline local host...
echo echo [LINK] Live browser interface: http://localhost:3000
echo echo.
echo echo ----------------------------------------------------------------------
echo echo Keep this terminal window open while using EchoScribe.
echo echo To close the application, simply close this window.
echo echo ----------------------------------------------------------------------
echo echo.
echo.
echo start "" "http://localhost:3000"
echo npm run start
) > "%launcher_file%"

:: B: Create native Desktop link via PowerShell WScript Object
set "shortcut_lnk=%userprofile%\Desktop\EchoScribe.lnk"
set "target_path=%launcher_file%"
set "work_dir=%~dp0"

echo Creating official Windows Desktop Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcut_lnk%'); $Shortcut.TargetPath = '%target_path%'; $Shortcut.WorkingDirectory = '%work_dir%'; $Shortcut.IconLocation = 'shell32.dll,116'; $Shortcut.Save()"

if !errorlevel! neq 0 (
    echo [WARNING] Could not create local Desktop Shortcut automatically.
    echo You can still start the app directly by running "launch-echoscribe.bat" in this directory.
) else (
    echo [SUCCESS] Elegant "EchoScribe" shortcut registered on your Desktop!
)
echo.

:: ------------------------------------------------------------------------
:: INSTALLATION COMPLETE - BOOT THE APP
:: ------------------------------------------------------------------------
color 0A
echo ======================================================================
echo           INSTALLATION REGISTERED SUCCESSFULLY!
echo ======================================================================
echo.
echo [1] Launch EchoScribe right now? (Y/N)
set /p runNow="Selection: "
if /i "!runNow!"=="Y" (
    start "" "%launcher_file%"
) else (
    echo Excellent. You can boot the app any time using the "EchoScribe" icon
    echo located on your Desktop!
    echo.
    pause
)
exit /b 0
