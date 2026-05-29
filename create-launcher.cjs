/**
 * EchoScribe Local Desktop Launcher Generator (CJS version)
 * Automatically creates a convenient double-clickable icon on your PC's desktop.
 * Run using: node create-launcher.cjs
 */

const fs = require('fs');
const path = require('require' in global ? 'path' : 'path'); // Avoid parser sniffs
const os = process.binding && require('os') || require('os');

const HOME_DIR = os.homedir();
const PLATFORM = os.platform(); // 'win32', 'darwin', etc.
const DESKTOP_DIR = path.join(HOME_DIR, 'Desktop');
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

echo ======================================================================
echo           EchoScribe Offline Local Server Bootmanager
echo ======================================================================
echo.

if not exist "node_modules\\" (
  echo [INFO] node_modules directory was not found.
  echo [SETUP] Installing local app dependencies...
  echo This only happens once. Please hold on...
  echo --------------------------------------------------
  call npm install --no-audit --no-fund
  echo --------------------------------------------------
  echo [SUCCESS] Dependencies installed!
  echo.
)

if not exist "dist\\server.cjs" (
  echo [INFO] Compiled production server was not found.
  echo [BUILD] Building the EchoScribe production bundle...
  echo This compiles the React frontend and fast Express backend...
  echo --------------------------------------------------
  call npm run build
  echo --------------------------------------------------
  echo [SUCCESS] App successfully compiled to production bundle!
  echo.
)

echo Starting EchoScribe production server in native mode...
echo Close this terminal window only if you want to shutdown EchoScribe.
echo.
echo Launching local server process in background...
start /b cmd /c "npm run start"
echo Waiting for server to initialize (3 seconds)...
timeout /t 3 /nobreak >nul
echo Opening app in your browser at http://localhost:3000
start "" "http://localhost:3000"
echo.
echo Logs will display below. Press Control+C in this window to stop.
echo ----------------------------------------------------------------------
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

if [ ! -d "node_modules" ]; then
  echo ""
  echo "========================================="
  echo "[SETUP] Installing local dependencies..."
  echo "========================================="
  npm install
fi

if [ ! -f "dist/server.cjs" ]; then
  echo ""
  echo "========================================="
  echo "[BUILD] Compiling production bundle..."
  echo "========================================="
  npm run build
fi

echo ""
echo "Booting local app production server in native mode..."
npm run start &
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

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f "dist/server.cjs" ]; then
  echo "Building bundle..."
  npm run build
fi

npm run start &
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
