import fontData from "./keychain-fonts.json";

export type KeychainFont = keyof typeof fontData;
export type KeychainSize = "regular" | "medium" | "large";
export type KeychainInput = { name: string; font: KeychainFont; size: KeychainSize; baseColour: string; letterColour: string };
export type Triangle = [number, number, number, number, number, number, number, number, number];
export type KeychainModel = { base: Triangle[]; letters: Triangle[]; widthMm: number; heightMm: number; letterHeightMm: number; input: KeychainInput };

export const KEYCHAIN_FONTS: Record<KeychainFont, string> = { rounded: "Rounded bold", classic: "Classic serif", mono: "Mono bold" };
export const KEYCHAIN_SIZES = { regular: { height: 10, minimum: 8, maxLength: 90 }, medium: { height: 15, minimum: 10, maxLength: 110 }, large: { height: 20, minimum: 12, maxLength: 130 } } as const;
export const KEYCHAIN_COLOURS: Record<string, string> = { white: "#F7F5EF", black: "#28282B", peach: "#F5AA82", lavender: "#BCA7D9", mint: "#A5CDBC", sky: "#A6CBE2", yellow: "#F0CE72", pink: "#E9ADBF" };

function contains(x: number, y: number, paths: number[][][]) {
  let inside = false;
  for (const path of paths) for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i], b = path[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function addFace(out: Triangle[], a: number[], b: number[], c: number[], d: number[]) {
  out.push([...a, ...b, ...c] as Triangle, [...a, ...c, ...d] as Triangle);
}

function gridMesh(grid: Uint8Array, w: number, h: number, originX: number, originY: number, pitch: number, bottom: number, top: number) {
  const triangles: Triangle[] = [];
  const coord = (value: number) => Math.round(value * 1000) / 1000;
  type Point = [number, number];
  const midpoint = (a: Point, b: Point): Point => [coord((a[0] + b[0]) / 2), coord((a[1] + b[1]) / 2)];
  const cap = (polygon: Point[]) => {
    for (let i = 1; i < polygon.length - 1; i++) {
      const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]];
      triangles.push([a[0], a[1], top, b[0], b[1], top, c[0], c[1], top]);
      triangles.push([c[0], c[1], bottom, b[0], b[1], bottom, a[0], a[1], bottom]);
    }
  };
  const cutTriangle = (points: [Point, Point, Point], inside: [boolean, boolean, boolean]) => {
    const polygon: Point[] = [], crossings: Point[] = [];
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      if (inside[i]) polygon.push(points[i]);
      if (inside[i] !== inside[next]) {
        const crossing = midpoint(points[i], points[next]);
        polygon.push(crossing);
        crossings.push(crossing);
      }
    }
    if (polygon.length >= 3) cap(polygon);
    if (crossings.length === 2) {
      const [a, b] = polygon.indexOf(crossings[1]) === (polygon.indexOf(crossings[0]) + 1) % polygon.length ? crossings : [crossings[1], crossings[0]];
      addFace(triangles, [a[0], a[1], bottom], [b[0], b[1], bottom], [b[0], b[1], top], [a[0], a[1], top]);
    }
  };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const bits = [grid[y*w+x], grid[y*w+x+1], grid[(y+1)*w+x+1], grid[(y+1)*w+x]];
    const count = bits[0] + bits[1] + bits[2] + bits[3];
    if (!count) continue;
    const x0 = coord(originX + (x + .5) * pitch), x1 = coord(originX + (x + 1.5) * pitch);
    const y0 = coord(originY + (y + .5) * pitch), y1 = coord(originY + (y + 1.5) * pitch);
    const points: Point[] = [[x0,y0], [x1,y0], [x1,y1], [x0,y1]];
    if (count === 4) { cap(points); continue; }
    const centre: Point = midpoint(points[0], points[2]);
    const centreInside = count >= 3 || (count === 2 && (bits[0] === bits[1] || bits[1] === bits[2] || bits[2] === bits[3] || bits[3] === bits[0]));
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      cutTriangle([points[i], points[next], centre], [Boolean(bits[i]), Boolean(bits[next]), centreInside]);
    }
  }
  return triangles;
}

export function generateKeychain(input: KeychainInput): KeychainModel {
  const name = input.name.trim().normalize("NFC");
  if (!name || name.length > 24 || !/^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(name)) throw new Error("Use 1–24 letters; spaces, apostrophes and hyphens are allowed between words.");
  if (!(input.font in KEYCHAIN_FONTS) || !(input.size in KEYCHAIN_SIZES)) throw new Error("Choose an available font and size.");
  if (!(input.baseColour in KEYCHAIN_COLOURS) || !(input.letterColour in KEYCHAIN_COLOURS) || input.baseColour === input.letterColour) throw new Error("Choose two different available colours.");
  const config = KEYCHAIN_SIZES[input.size];
  const font = fontData[input.font] as { unitsPerEm: number; glyphs: Record<string,{advance:number;paths:number[][][]}> };
  const cap = Math.max(...font.glyphs.H.paths.flat().map(point => point[1]));
  const advances = [...name].map(c => font.glyphs[c]?.advance ?? 0);
  const widthUnits = advances.reduce((a, b) => a + b, 0);
  const outerAllowance = 11; // contour and left-hand keyring loop
  const height = Math.min(config.height, (config.maxLength - outerAllowance) * cap / widthUnits);
  if (height < config.minimum) throw new Error("This name is too long for this size and font. Try another size or shorten the name.");
  const scale = height / cap;
  const glyphs: { offset: number; paths: number[][][]; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  let cursor = 0;
  for (const c of name) {
    const glyph = font.glyphs[c];
    if (!glyph) throw new Error("Unsupported character in name.");
    const points = glyph.paths.flat();
    if (points.length) glyphs.push({ offset: cursor, paths: glyph.paths, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) });
    cursor += glyph.advance * scale;
  }
  const minY = Math.min(0, ...glyphs.map(g => g.minY * scale));
  const maxY = Math.max(height, ...glyphs.map(g => g.maxY * scale));
  const pitch = 0.2, padding = 5, tabX = -3.5, tabY = (minY + maxY) / 2;
  const originX = Math.floor((tabX - 3.5 - padding) / pitch) * pitch;
  const originY = Math.floor((minY - padding) / pitch) * pitch;
  const w = Math.ceil((cursor + padding - originX) / pitch), h = Math.ceil((maxY + padding - originY) / pitch);
  const text = new Uint8Array(w*h), base = new Uint8Array(w*h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = originX + (x+.5)*pitch, py = originY + (y+.5)*pitch;
    for (const g of glyphs) {
      const gx = (px - g.offset) / scale, gy = py / scale;
      if (gx < g.minX-1 || gx > g.maxX+1 || gy < g.minY-1 || gy > g.maxY+1) continue;
      if (contains(gx, gy, g.paths)) { text[y*w+x] = 1; break; }
    }
  }
  // Morphological offset joins the glyph islands, including dots and counters, into a solid backing.
  const radius = Math.ceil(1.6/pitch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (text[y*w+x]) {
    for (let dy=-radius;dy<=radius;dy++) for (let dx=-radius;dx<=radius;dx++) if (dx*dx+dy*dy <= radius*radius) {
      const xx=x+dx, yy=y+dy; if (xx>=0 && xx<w && yy>=0 && yy<h) base[yy*w+xx]=1;
    }
  }
  // Continuous bridge to the ring; use a rounded loop with an open central hole.
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const px=originX+(x+.5)*pitch, py=originY+(y+.5)*pitch;
    const distance=Math.hypot(px-tabX,py-tabY);
    if (distance <= 3.2 || (px>=tabX && px<=1.2 && Math.abs(py-tabY)<=2.2)) base[y*w+x]=1;
    if (distance < 1.6) base[y*w+x]=0;
  }
  const occupied = (grid: Uint8Array) => { const xs:number[]=[], ys:number[]=[]; for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(grid[y*w+x]){xs.push(x);ys.push(y)} return {xs,ys}; };
  const bounds = occupied(base);
  const actualWidth = (Math.max(...bounds.xs)-Math.min(...bounds.xs)+1)*pitch;
  if (actualWidth > config.maxLength + pitch) throw new Error("Name exceeds the maximum keychain length.");
  return { base: gridMesh(base,w,h,originX,originY,pitch,0,3.5), letters: gridMesh(text,w,h,originX,originY,pitch,3.5,4.5), widthMm: Math.round(actualWidth*10)/10, heightMm: Math.round((Math.max(...bounds.ys)-Math.min(...bounds.ys)+1)*pitch*10)/10, letterHeightMm: Math.round(height*10)/10, input: {...input,name} };
}
