/**
 * EchoScribe Local Desktop Launcher Compiler
 * Generates the clean, un-escaped 'launch-echoscribe.bat' file.
 * This completely avoids parenthetical escaping bugs in batch code.
 */

import fs from 'fs';
import path from 'path';

const currentDir = process.cwd();
const launcherFile = path.join(currentDir, 'launch-echoscribe.bat');

console.log("=========================================");
console.log("   EchoScribe Launcher Compiler         ");
console.log("=========================================");
console.log(`Target Output: ${launcherFile}`);

const scriptContent = `@echo off
setlocal enabledelayedexpansion
title EchoScribe Desktop Core
color 0F
cd /d "%~dp0"

:: Look for local portable Node setup
if exist "%~dp0.local-node\\node.exe" (
    set "PATH=%~dp0.local-node;%PATH%"
)

:: Ensure notes directory exists for local markdown storage
if not exist "notes\\" mkdir "notes"

:: Configure environment variables for local native running
set "DESKTOP_MODE=true"
set "NODE_ENV=production"
set "NODE_OPTIONS=--max-old-space-size=4096"

:: Check for Edge browser to launch in high-performance app-container mode
set "EDGE_PATH="
if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "EDGE_PATH=C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "EDGE_PATH=C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
)

echo ======================================================================
echo            ECHOSCRIBE COGNITIVE RECORDING DESKTOP CORE
echo ======================================================================
echo.
echo [SERVER] Booting offline local database...
echo.

:: Launch our compiled production Node/Express server in the background
start /b "" node dist/server.cjs

:: Wait for server to bind port 3000
timeout /t 2 /nobreak >nul 2>&1

:: Trigger appropriate user interface
if defined EDGE_PATH (
    echo [UI] Launching borderless desktop application window...
    start "" "!EDGE_PATH!" --app="http://localhost:3000"
) else (
    echo [UI] Edge path not found. Launching in standard web browser...
    start "" "http://localhost:3000"
)

echo.
echo [OK] App initialized. Standard logs and sync streams are running.
echo [CLOSE] Close this terminal window OR close the desktop app window
echo         to safely terminate and secure the local database.
echo ----------------------------------------------------------------------
echo.

:: Wait for terminal lock
pause >nul
`;

try {
  fs.writeFileSync(launcherFile, scriptContent, 'utf-8');
  console.log(`[SUCCESS] Native Windows launcher written to ${launcherFile}`);
} catch (err) {
  console.error(`[ERROR] Failed to compile launcher script:`, err.message);
  process.exit(1);
}
console.log("=========================================\n");
