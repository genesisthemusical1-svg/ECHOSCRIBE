/**
 * EchoScribe Local Desktop Launcher Generator
 * Automatically creates a convenient double-clickable icon on your PC's desktop.
 * Run using: node create-launcher.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME_DIR = os.homedir();
const PLATFORM = os.platform(); // 'win32', 'darwin', etc.
const DESKTOP_DIR = path.join(HOME_DIR, 'Desktop');

// Target launch command
const targetFolder = __dirname;

console.log("=========================================");
console.log("   EchoScribe Desktop Icon Installer    ");
console.log("=========================================");
console.log(`Current platform: ${PLATFORM}`);
console.log(`Target Folder   : ${targetFolder}`);
console.log(`User Desktop    : ${DESKTOP_DIR}`);

if (PLATFORM === 'win32') {
  // --- WIN32 WINDOWS BATCH LAUNCHER ---
  const batchPath = path.join(DESKTOP_DIR, 'EchoScribe.bat');
  const winScript = `@echo off
title EchoScribe Local Server Manager
cd /d "${targetFolder}"
echo Starting EchoScribe offline local core...
echo Close this terminal window only if you want to turn off the recorder app.
echo.
echo Launching local server process in background...
start /b cmd /c "npm run dev"
echo Waiting for server to initialize (3 seconds)...
timeout /t 3 /nobreak >nul
echo Opening app in browser at http://localhost:3000
start "" "http://localhost:3000"
echo.
echo Logs will display below. Press Control+C in this window to stop.
echo ----------------------------------------------------------------------
:: This keeps the batch process running so logs continue streaming
pause >nul
`;

  try {
    fs.writeFileSync(batchPath, winScript, 'utf-8');
    console.log("\n[SUCCESS] Windows launcher created!");
    console.log(`📍 Double-click the "EchoScribe.bat" file now created on your Desktop to boot the app.`);
  } catch (err) {
    console.error("Failed to write to Windows Desktop folder:", err.message);
  }
} else if (PLATFORM === 'darwin') {
  // --- MACOS SHELL COMMAND LAUNCHER ---
  const appPath = path.join(DESKTOP_DIR, 'EchoScribe.command');
  const macScript = `#!/bin/bash
clear
echo "========================================="
echo "   EchoScribe Local Server Manager      "
echo "========================================="
cd "${targetFolder}"
echo "Booting local app server process..."
npm run dev &
SERVER_PID=$!

echo "Waiting for server to initialize (3 seconds)..."
sleep 3
echo "Opening app in browser at http://localhost:3000 ..."
open "http://localhost:3000"

# Wait for background server process to complete
wait $SERVER_PID
`;

  try {
    fs.writeFileSync(appPath, macScript, 'utf-8');
    // Set executable file permissions
    fs.chmodSync(appPath, '755');
    console.log("\n[SUCCESS] macOS launcher created!");
    console.log(`📍 Double-click the "EchoScribe.command" file now created on your Desktop to boot the app.`);
  } catch (err) {
    console.error("Failed to write to macOS Desktop folder:", err.message);
  }
} else {
  // Linux fallback
  const linuxPath = path.join(DESKTOP_DIR, 'EchoScribe.sh');
  const linuxScript = `#!/bin/bash
cd "${targetFolder}"
npm run dev &
SERVER_PID=$!
sleep 3
xdg-open "http://localhost:3000"
wait $SERVER_PID
`;
  try {
    fs.writeFileSync(linuxPath, linuxScript, 'utf-8');
    fs.chmodSync(linuxPath, '755');
    console.log("\n[SUCCESS] Linux launcher compiled to " + linuxPath);
  } catch (err) {
    console.error(err);
  }
}

console.log("=========================================");
