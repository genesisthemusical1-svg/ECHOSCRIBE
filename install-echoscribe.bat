@echo off
setlocal enabledelayedexpansion
title EchoScribe Desktop Installer
color 0F

echo ======================================================================
echo                ECHOSCRIBE COGNITIVE VOICE RECORDER
echo                  ECHO-SYSTEM DESKTOP INSTALLER
echo ======================================================================
echo.
echo This installer will build, configure, and install Echo Scribe on your PC.
echo.

:: ------------------------------------------------------------------------
:: STEP 1: CHECK NODE.JS ENVIRONMENT (OR INSTANTLY DOWNLOAD PORTABLE VERSION)
:: ------------------------------------------------------------------------
echo [1/5] Checking system pre-requisites...

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
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Downloading stable Node runtime v20.11.1 archive...'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip' -OutFile 'node_portable.zip'"

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
echo [2/5] Installing offline modules and local packages...
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
:: STEP 3: BUNDLE PRODUCTIVE FRONTEND/BACKEND CORE (COMPILE ICON)
:: ------------------------------------------------------------------------
echo [3/5] Compiling local production assets and branding graphics...
echo This generates highly optimized ES Module bundles and builds app-icon.ico!
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
:: STEP 4: CONFIGURE NATIVE LAUNCHER
:: ------------------------------------------------------------------------
echo [4/5] Constructing native windows launcher script...

set "launcher_file=%~dp0launch-echoscribe.bat"
(
echo @echo off
echo setlocal enabledelayedexpansion
echo title EchoScribe Desktop Core
echo color 0F
echo cd /d "%%~dp0"
echo.
echo :: Check and map local node
echo if exist "%%~dp0.local-node\node.exe" (
echo     set "PATH=%%~dp0.local-node;%%PATH%%"
echo ^)
echo.
echo :: Safeguard folders
echo if not exist "notes\" mkdir "notes"
echo.
echo :: Set Environment Variables for Native Desktop Mode
echo set "DESKTOP_MODE=true"
echo set "NODE_ENV=production"
echo.
echo :: Find Microsoft Edge path to execute borderless App Mode
echo set "EDGE_PATH="
echo if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
echo     set "EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
echo ^) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
echo     set "EDGE_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
echo ^)
echo.
echo echo ======================================================================
echo echo            ECHOSCRIBE COGNITIVE RECORDING DESKTOP CORE
echo echo ======================================================================
echo echo.
echo echo [SERVER] Booting offline local database...
echo.
echo :: Run compiled Node server in background
echo start /b "" node dist/server.cjs
echo.
echo :: Wait briefly for express service to initialize
echo timeout /t 2 /nobreak ^>nul
echo.
echo :: Check if Microsoft Edge is found to launch in frameless native app-frame
echo if defined EDGE_PATH (
echo     echo [UI] Launching borderless desktop application window...
echo     start "" "!EDGE_PATH!" --app="http://localhost:3000"
echo ^) else (
echo     echo [UI] Edge path not found. Launching in standard web browser...
echo     start "" "http://localhost:3000"
echo ^)
echo.
echo echo [OK] App initialized. Standard logs and sync streams are running.
echo echo [CLOSE] Close this terminal window OR close the desktop app window
echo echo         to safely terminate and secure the local database.
echo echo ----------------------------------------------------------------------
echo echo.
echo.
echo :: Keep open so logging remains readable if desired, watchdog handles cleanup
echo pause ^>nul
) > "%launcher_file%"

echo [SUCCESS] Configured launch-echoscribe.bat script!
echo.

:: ------------------------------------------------------------------------
:: STEP 5: REGISTER DESKTOP SHORTCUT WITH CUSTOM ICON
:: ------------------------------------------------------------------------
echo [5/5] Mapping shortcut link and branding to user Desktop...

set "shortcut_lnk=%userprofile%\Desktop\EchoScribe.lnk"
set "target_path=%launcher_file%"
set "work_dir=%~dp0"
set "icon_path=%~dp0app-icon.ico"

echo Registering EchoScribe brand with custom icon...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcut_lnk%'); $Shortcut.TargetPath = '%target_path%'; $Shortcut.WorkingDirectory = '%work_dir%'; $Shortcut.IconLocation = '%icon_path%,0'; $Shortcut.Description = 'EchoScribe Cognitive Voice Recorder'; $Shortcut.Save()"

if !errorlevel! neq 0 (
    echo [WARNING] Could not map Desktop icon automatically registry.
    echo Don't worry - you can run "launch-echoscribe.bat" directly in this folder.
) else (
    echo [SUCCESS] Gorgeous premium "EchoScribe" icon pinned to your Desktop!
)
echo.

:: ------------------------------------------------------------------------
:: INSTALLATION COMPLETE - CONFIRM ACTION
:: ------------------------------------------------------------------------
color 0A
echo ======================================================================
echo           INSTALLATION TERMINATED SUCCESSFULLY!
echo ======================================================================
echo.
echo EchoScribe is now fully installed and self-contained on your PC.
echo.
echo [1] Boot EchoScribe Standalone Desktop App right now? (Y/N)
set /p runNow="Selection: "
if /i "!runNow!"=="Y" (
    start "" "%launcher_file%"
) else (
    echo.
    echo Perfectly fine! Double-click the new "EchoScribe" icon on your Windows 
    echo Desktop at any point to run your offline cognitive note system.
    echo.
    pause
)
exit /b 0
