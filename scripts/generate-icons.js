const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../src/static/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const createSimplePNG = (width, height, r, g, b, a = 255) => {
  const png = [];
  
  png.push(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
  
  const ihdr = [
    (width >> 24) & 0xFF, (width >> 16) & 0xFF, (width >> 8) & 0xFF, width & 0xFF,
    (height >> 24) & 0xFF, (height >> 16) & 0xFF, (height >> 8) & 0xFF, height & 0xFF,
    8, 6, 0, 0, 0
  ];
  
  const ihdrCrc = crc32([0x49, 0x48, 0x44, 0x52, ...ihdr]);
  png.push(0, 0, 0, 13);
  png.push(0x49, 0x48, 0x44, 0x52);
  png.push(...ihdr);
  png.push((ihdrCrc >> 24) & 0xFF, (ihdrCrc >> 16) & 0xFF, (ihdrCrc >> 8) & 0xFF, ihdrCrc & 0xFF);
  
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b, a);
    }
  }
  
  const deflated = deflateRaw(rawData);
  const idatCrc = crc32([0x49, 0x44, 0x41, 0x54, ...deflated]);
  png.push((deflated.length >> 24) & 0xFF, (deflated.length >> 16) & 0xFF, (deflated.length >> 8) & 0xFF, deflated.length & 0xFF);
  png.push(0x49, 0x44, 0x41, 0x54);
  png.push(...deflated);
  png.push((idatCrc >> 24) & 0xFF, (idatCrc >> 16) & 0xFF, (idatCrc >> 8) & 0xFF, idatCrc & 0xFF);
  
  const iendCrc = crc32([0x49, 0x45, 0x4E, 0x44]);
  png.push(0, 0, 0, 0);
  png.push(0x49, 0x45, 0x4E, 0x44);
  png.push((iendCrc >> 24) & 0xFF, (iendCrc >> 16) & 0xFF, (iendCrc >> 8) & 0xFF, iendCrc & 0xFF);
  
  return Buffer.from(png);
};

const crc32Table = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crc32Table[i] = c;
}

const crc32 = (data) => {
  let crc = 0xFFFFFFFF;
  for (const byte of data) {
    crc = crc32Table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const deflateRaw = (data) => {
  const result = [0x78, 0x01];
  const blockSize = 65535;
  
  for (let i = 0; i < data.length; i += blockSize) {
    const block = data.slice(i, Math.min(i + blockSize, data.length));
    const isLast = i + blockSize >= data.length;
    result.push(isLast ? 1 : 0);
    const len = block.length;
    result.push(len & 0xFF, (len >> 8) & 0xFF);
    result.push((~len) & 0xFF, ((~len) >> 8) & 0xFF);
    result.push(...block);
  }
  
  let a = 1, b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;
  result.push((adler >> 24) & 0xFF, (adler >> 16) & 0xFF, (adler >> 8) & 0xFF, adler & 0xFF);
  
  return result;
};

const icons = [
  { name: 'home.png', color: [153, 153, 153] },
  { name: 'home-active.png', color: [102, 126, 234] },
  { name: 'book.png', color: [153, 153, 153] },
  { name: 'book-active.png', color: [102, 126, 234] },
  { name: 'listen.png', color: [153, 153, 153] },
  { name: 'listen-active.png', color: [102, 126, 234] },
  { name: 'chat.png', color: [153, 153, 153] },
  { name: 'chat-active.png', color: [102, 126, 234] }
];

icons.forEach(icon => {
  const png = createSimplePNG(48, 48, ...icon.color);
  fs.writeFileSync(path.join(iconsDir, icon.name), png);
  console.log(`Created: ${icon.name}`);
});

console.log('All icons created successfully!');
