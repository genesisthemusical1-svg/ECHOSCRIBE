/**
 * EchoScribe PNG-to-ICO Asset Compiler
 * Generates an authentic Windows '.ico' icon resource directly from our transparent PNG logo.
 * Does not require external binary node packages.
 */

import fs from 'fs';
import path from 'path';

const imgDir = path.join(process.cwd(), 'src', 'assets', 'images');
const pngFile = path.join(imgDir, 'echoscribe_transparent_logo_1779772421258.png');
const icoFile = path.join(process.cwd(), 'app-icon.ico');

console.log("=========================================");
console.log("   EchoScribe Native Asset Compiler     ");
console.log("=========================================");

if (fs.existsSync(pngFile)) {
  const pngData = fs.readFileSync(pngFile);
  const size = pngData.length;
  
  // Create standard Windows ICO header + 1 directory entry (total 22 bytes)
  const header = Buffer.alloc(22);
  
  // Header: Reserved (0), Type (1 = Icon), Count (1)
  header.writeUInt16LE(0, 0);     // Reserved
  header.writeUInt16LE(1, 2);     // Type (1 = Icon)
  header.writeUInt16LE(1, 4);     // Count of images (1)
  
  // Directory Entry: Match 256x256 resolution
  header.writeUInt8(0, 6);        // Width (0 = 256px)
  header.writeUInt8(0, 7);        // Height (0 = 256px)
  header.writeUInt8(0, 8);        // Color count (0 = no palette)
  header.writeUInt8(0, 9);        // Reserved (0)
  header.writeUInt16LE(1, 10);    // Color Planes (1)
  header.writeUInt16LE(32, 12);   // Bits per Pixel (32)
  header.writeUInt32LE(size, 14); // Size of the PNG image resource data
  header.writeUInt32LE(22, 18);   // Offset of the raw PNG content starting right after 22-byte header
  
  // Combine header and direct PNG stream
  const icoData = Buffer.concat([header, pngData]);
  fs.writeFileSync(icoFile, icoData);
  console.log(`[SUCCESS] Compiled transparent PNG asset into Windows app-icon.ico!`);
  console.log(`Saved: ${icoFile} (${icoData.length} bytes)`);
} else {
  console.error(`[ERROR] Standard logo PNG not found at: ${pngFile}`);
}
console.log("=========================================\n");
