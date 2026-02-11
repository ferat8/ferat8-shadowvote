const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Minimal PNG generator
function createPNG(width, height, r, g, b) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = createChunk("IHDR", ihdrData);

  // IDAT chunk (image data)
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk("IDAT", compressed);

  // IEND chunk
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data) {
  let crc = 0xffffffff;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(__dirname, "../public");

// Generate images
const images = [
  { name: "icon.png", size: 1024, color: [139, 92, 246] },       // Purple
  { name: "icon-192.png", size: 192, color: [139, 92, 246] },
  { name: "icon-512.png", size: 512, color: [139, 92, 246] },
  { name: "splash.png", size: 200, color: [10, 10, 15] },        // Dark
  { name: "hero.png", size: 600, color: [139, 92, 246] },        // 1200x630 aspect
  { name: "og-image.png", size: 630, color: [10, 10, 15] },
  { name: "screenshot1.png", size: 400, color: [19, 19, 26] },
  { name: "screenshot2.png", size: 400, color: [19, 19, 26] },
  { name: "screenshot3.png", size: 400, color: [19, 19, 26] },
];

console.log("Generating placeholder images...");

for (const img of images) {
  const [r, g, b] = img.color;
  const width = img.name.includes("hero") || img.name.includes("og") ? img.size * 2 : img.size;
  const height = img.size;
  
  const png = createPNG(width, height, r, g, b);
  fs.writeFileSync(path.join(publicDir, img.name), png);
  console.log(`Created ${img.name} (${width}x${height})`);
}

console.log("Done!");
