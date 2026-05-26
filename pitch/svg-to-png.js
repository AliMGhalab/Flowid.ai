/**
 * Convert Agent_Framework_Diagram.svg → high-resolution PNG
 * Output: 3200×1800 (2× the SVG viewBox for crisp PowerPoint rendering)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_PATH = path.join(__dirname, 'Agent_Framework_Diagram.svg');
const PNG_PATH = path.join(__dirname, 'Agent_Framework_Diagram.png');

const SCALE = 2;            // 2× scale for crispness
const TARGET_W = 1600 * SCALE;
const TARGET_H =  900 * SCALE;

(async () => {
  try {
    const svgBuffer = fs.readFileSync(SVG_PATH);

    await sharp(svgBuffer, { density: 300 })   // high DPI rasterization
      .resize(TARGET_W, TARGET_H, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(PNG_PATH);

    const stat = fs.statSync(PNG_PATH);
    console.log(`✓ Generated: ${PNG_PATH}`);
    console.log(`  ${TARGET_W}×${TARGET_H} · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exit(1);
  }
})();
