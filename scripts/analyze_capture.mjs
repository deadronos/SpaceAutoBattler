import fs from 'fs';
import { PNG } from 'pngjs';

function colorDistance(r1,g1,b1,r2,g2,b2){
  return Math.sqrt((r1-r2)*(r1-r2)+(g1-g2)*(g1-g2)+(b1-b2)*(b1-b2));
}

async function run(){
  const path = process.argv[2] || '.playwright-mcp/capture_carriers.png';
  if(!fs.existsSync(path)){
    console.error('screenshot not found:', path);
    process.exit(2);
  }
  const data = fs.readFileSync(path);
  const png = PNG.sync.read(data);
  const {width, height, data: buf} = png;
  // Team colors from runtime_inspect results
  const red = {r:0xff, g:0x4d, b:0x4d};
  const blue = {r:0x4d, g:0xa6, b:0xff};
  let redPixels = 0, bluePixels = 0;
  const threshold = 60; // permissive
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const idx = (width*y + x) << 2;
      const r = buf[idx], g = buf[idx+1], b = buf[idx+2], a = buf[idx+3];
      if(a < 16) continue;
      const dR = colorDistance(r,g,b, red.r, red.g, red.b);
      const dB = colorDistance(r,g,b, blue.r, blue.g, blue.b);
      if(dR <= threshold) redPixels++;
      if(dB <= threshold) bluePixels++;
    }
  }
  console.log('image size:', width, 'x', height);
  console.log('redPixels:', redPixels, 'bluePixels:', bluePixels);
  if(redPixels>0) console.log('RED detected'); else console.log('RED NOT detected');
  if(bluePixels>0) console.log('BLUE detected'); else console.log('BLUE NOT detected');
}
run().catch(e=>{ console.error(e); process.exit(1); });
