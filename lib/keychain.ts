import fontData from "./keychain-fonts.json";

export type KeychainFont = keyof typeof fontData | "roundedItalic" | "classicItalic" | "compact";
export type KeychainSize = "regular" | "medium" | "large";
export type KeychainBaseShape = "contour" | "rectangle";
export type KeychainAttachment = "keychain" | "tag";
export type KeychainLetterFinish = "raised" | "inlaid";
export type KeychainInput = { name: string; font: KeychainFont; size: KeychainSize; baseShape?: KeychainBaseShape; attachment?: KeychainAttachment; letterFinish?: KeychainLetterFinish; baseColour: string; letterColour: string; palette?: Record<string, string> };
export type Triangle = [number, number, number, number, number, number, number, number, number];
export type KeychainModel = { base: Triangle[]; baseCap: Triangle[]; letters: Triangle[]; widthMm: number; heightMm: number; centreX: number; centreY: number; letterHeightMm: number; input: KeychainInput };

export const KEYCHAIN_FONTS: Record<KeychainFont, string> = { rounded: "Rounded bold", roundedItalic: "Rounded italic", classic: "Classic serif", classicItalic: "Classic italic", mono: "Mono bold", compact: "Compact bold" };
export const KEYCHAIN_SIZES = { regular: { height: 10, minimum: 8, maxLength: 90 }, medium: { height: 15, minimum: 10, maxLength: 110 }, large: { height: 20, minimum: 12, maxLength: 130 } } as const;
export const KEYCHAIN_BASE_SHAPES: Record<KeychainBaseShape, string> = { contour: "Follows the name", rectangle: "Rounded rectangle" };
export const KEYCHAIN_LETTER_FINISHES: Record<KeychainLetterFinish, string> = { raised: "Raised letters", inlaid: "Flush letters" };
export const KEYRING_HARDWARE = { "split-ring": "Silver split ring", "silver-clasp": "Silver clasp", "rose-gold-clasp": "Rose gold clasp", "gold-clasp": "Gold clasp" } as const;
export const KEYCHAIN_COLOURS: Record<string, string> = { white: "#F7F5EF", black: "#28282B", peach: "#F5AA82", lavender: "#BCA7D9", mint: "#A5CDBC", sky: "#A6CBE2", yellow: "#F0CE72", pink: "#E9ADBF" };

type Outlines = { unitsPerEm: number; glyphs: Record<string, { advance: number; paths: number[][][] }> };
const outlineCache = new Map<KeychainFont, Outlines>();
export function keychainFontOutlines(font: KeychainFont): Outlines {
  const cached = outlineCache.get(font);
  if (cached) return cached;
  const source = (font === "roundedItalic" || font === "compact" ? "rounded" : font === "classicItalic" ? "classic" : font) as keyof typeof fontData;
  const original = fontData[source] as Outlines;
  const shear = font === "roundedItalic" ? .22 : font === "classicItalic" ? .18 : 0;
  const width = font === "compact" ? .8 : 1;
  const transformed: Outlines = shear || width !== 1 ? {
    unitsPerEm: original.unitsPerEm,
    glyphs: Object.fromEntries(Object.entries(original.glyphs).map(([char, glyph]) => [char, {
      advance: glyph.advance * width,
      paths: glyph.paths.map(path => path.map(([x, y]) => [(x + shear * y) * width, y])),
    }])),
  } : original;
  outlineCache.set(font, transformed);
  return transformed;
}

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

function smoothMask(grid: Uint8Array, w: number, h: number) {
  const field = new Uint8Array(grid.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      sum += grid[(y + dy) * w + x + dx] * (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
    field[y * w + x] = sum >= 8 ? 1 : 0;
  }
  return field;
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
        const point = midpoint(points[i], points[next]);
        polygon.push(point);
        crossings.push(point);
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
  if (input.baseShape !== undefined && !(input.baseShape in KEYCHAIN_BASE_SHAPES)) throw new Error("Choose an available backing shape.");
  if (input.attachment !== undefined && !["keychain", "tag"].includes(input.attachment)) throw new Error("Choose a tag or keyring.");
  if (input.letterFinish !== undefined && !(input.letterFinish in KEYCHAIN_LETTER_FINISHES)) throw new Error("Choose raised or flush letters.");
  if (!/^#[0-9a-fA-F]{6}$/.test((input.palette ?? KEYCHAIN_COLOURS)[input.baseColour] ?? "") || !/^#[0-9a-fA-F]{6}$/.test((input.palette ?? KEYCHAIN_COLOURS)[input.letterColour] ?? "") || input.baseColour === input.letterColour) throw new Error("Choose two different available colours.");
  const config = KEYCHAIN_SIZES[input.size];
  const font = keychainFontOutlines(input.font);
  const cap = Math.max(...font.glyphs.H.paths.flat().map(point => point[1]));
  const positioned: { offset: number; paths: number[][][]; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  let right = 0, pendingSpace = 0;
  for (const c of name) {
    const glyph = font.glyphs[c];
    if (!glyph) throw new Error("Unsupported character in name.");
    const points = glyph.paths.flat();
    if (!points.length) { pendingSpace += glyph.advance; continue; }
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
    const offset = positioned.length ? right + (pendingSpace ? cap * .35 : cap * .055) - minX : -minX;
    positioned.push({ offset, paths: glyph.paths, minX, maxX, minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) });
    right = offset + maxX; pendingSpace = 0;
  }
  const widthUnits = right;
  const outerAllowance = input.attachment === "tag" ? 7 : 11;
  const height = Math.min(config.height, (config.maxLength - outerAllowance) * cap / widthUnits);
  if (height < config.minimum) throw new Error("This name is too long for this size and font. Try another size or shorten the name.");
  const scale = height / cap;
  const glyphs = positioned.map(g => ({ ...g, offset: g.offset * scale }));
  const cursor = widthUnits * scale;
  const minY = Math.min(0, ...glyphs.map(g => g.minY * scale));
  const maxY = Math.max(height, ...glyphs.map(g => g.maxY * scale));
  const pitch = 0.15, padding = 7, tabY = minY + (maxY-minY)*.55;
  const originX = Math.floor((-8-padding) / pitch) * pitch;
  const originY = Math.floor((minY - padding) / pitch) * pitch;
  const w = Math.ceil((cursor + padding - originX) / pitch), h = Math.ceil((maxY + padding - originY) / pitch);
  const text = new Uint8Array(w*h), base = new Uint8Array(w*h);
  const rowLeft = glyphs.map(() => new Int32Array(h).fill(w));
  const rowRight = glyphs.map(() => new Int32Array(h).fill(-1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = originX + (x+.5)*pitch, py = originY + (y+.5)*pitch;
    for (let index=0;index<glyphs.length;index++) {
      const g=glyphs[index];
      const gx = (px - g.offset) / scale, gy = py / scale;
      if (gx < g.minX-1 || gx > g.maxX+1 || gy < g.minY-1 || gy > g.maxY+1) continue;
      if (contains(gx, gy, g.paths)) {
        text[y*w+x] = 1;
        rowLeft[index][y] = Math.min(rowLeft[index][y],x);
        rowRight[index][y] = Math.max(rowRight[index][y],x);
      }
    }
  }
  // Morphological offset joins the glyph islands, including dots and counters, into a solid backing.
  const radius = Math.ceil((1.6 * height / 10)/pitch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (text[y*w+x]) {
    for (let dy=-radius;dy<=radius;dy++) for (let dx=-radius;dx<=radius;dx++) if (dx*dx+dy*dy <= radius*radius) {
      const xx=x+dx, yy=y+dy; if (xx>=0 && xx<w && yy>=0 && yy<h) base[yy*w+xx]=1;
    }
  }
  // Fill each visible gap between neighbouring glyphs through their shared height.
  // This produces a broad backing under the name, rather than a narrow spine.
  for (let y=0;y<h;y++) for (let index=0;index<glyphs.length-1;index++) {
    const from=rowRight[index][y], to=rowLeft[index+1][y];
    if (from<0 || to>=w || to-from>Math.ceil(height*.55/pitch)) continue;
    for(let x=from;x<=to;x++) base[y*w+x]=1;
  }
  // Interior counters such as D, a, and e need backing colour under the raised letter.
  // Flood the exterior before adding the keyring, so its hole stays open.
  const outside=new Uint8Array(base.length), queue=new Int32Array(base.length);
  let head=0,tail=0;
  const visit=(index:number)=>{if(!base[index]&&!outside[index]){outside[index]=1;queue[tail++]=index}};
  for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}
  for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
  while(head<tail){const index=queue[head++], x=index%w;
    if(x>0)visit(index-1);if(x<w-1)visit(index+1);
    if(index>=w)visit(index-w);if(index<base.length-w)visit(index+w);
  }
  for(let index=0;index<base.length;index++) if(!base[index]&&!outside[index])base[index]=1;
  // The loop overlaps the silhouette of the first letter directly; there is no connecting bar.
  let firstLeft = Infinity;
  for (let y=0;y<h;y++) if (Math.abs(originY+(y+.5)*pitch-tabY)<.75)
    for (let x=0;x<w;x++) if (text[y*w+x] && originX+(x+.5)*pitch<firstLeft) firstLeft=originX+(x+.5)*pitch;
  const tabX = (Number.isFinite(firstLeft) ? firstLeft : 0) - 2.6;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const px=originX+(x+.5)*pitch, py=originY+(y+.5)*pitch;
    const distance=Math.hypot(px-tabX,py-tabY);
    if (input.baseShape === "rectangle") {
      // A narrow border follows the measured glyph extents; the corner radius is 2 mm.
      const left = -1.5, right = cursor + 1.5, bottom = minY - 1.5, top = maxY + 1.5;
      const qx = Math.max(left + 2 - px, 0, px - (right - 2));
      const qy = Math.max(bottom + 2 - py, 0, py - (top - 2));
      base[y*w+x] = qx*qx + qy*qy <= 4 ? 1 : 0;
    }
    if (input.attachment !== "tag") {
      if (distance <= 3.2) base[y*w+x]=1;
      if (distance < 1.6) base[y*w+x]=0;
    }
  }
  let left=w, rightPixel=0, bottom=h, top=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) if(base[y*w+x]) {
    left=Math.min(left,x);rightPixel=Math.max(rightPixel,x);bottom=Math.min(bottom,y);top=Math.max(top,y);
  }
  const actualWidth = (rightPixel-left+1)*pitch;
  if (actualWidth > config.maxLength + pitch) throw new Error("Name exceeds the maximum keychain length.");
  const backing = smoothMask(base,w,h), lettering = smoothMask(text,w,h);
  const flush = input.letterFinish === "inlaid";
  // The flush cap is the complement of the letters. Both coloured volumes meet at z=3,
  // so their top faces are coplanar at z=4 without overlapping material.
  const flushCap = new Uint8Array(backing.length);
  if (flush) for (let index=0;index<flushCap.length;index++) flushCap[index]=backing[index] && !lettering[index] ? 1 : 0;
  const baseMesh=gridMesh(backing,w,h,originX,originY,pitch,0,flush?1.2:2.6);
  return { base: baseMesh, baseCap: flush ? gridMesh(flushCap,w,h,originX,originY,pitch,1.2,2.6) : [], letters: gridMesh(lettering,w,h,originX,originY,pitch,flush?1.2:2.6,flush?2.6:4), widthMm: Math.round(actualWidth*10)/10, heightMm: Math.round((top-bottom+1)*pitch*10)/10, centreX: originX+(left+rightPixel+1)*pitch/2, centreY: originY+(bottom+top+1)*pitch/2, letterHeightMm: Math.round(height*10)/10, input: {...input,name,baseShape:input.baseShape ?? "contour",attachment:input.attachment ?? "keychain",letterFinish:input.letterFinish ?? "raised"} };
}
