import { describe, expect, it } from "vitest";
import { generateKeychain, type Triangle } from "../lib/keychain";
import { binaryStl, keychain3mf } from "../lib/keychain-files";
import { inflateRawSync } from "node:zlib";

const choices = { font: "rounded" as const, size: "regular" as const, baseColour: "peach", letterColour: "white" };

function watertight(triangles: Triangle[]) {
  const edges = new Map<string,number>();
  for(const t of triangles){
    const points=[t.slice(0,3),t.slice(3,6),t.slice(6,9)].map(p=>p.map(n=>n.toFixed(3)).join(","));
    for(let i=0;i<3;i++){const edge=[points[i],points[(i+1)%3]].sort().join("|");edges.set(edge,(edges.get(edge)??0)+1)}
  }
  return [...edges.values()].every(count=>count===2);
}
function signedVolume(triangles: Triangle[]) {
  return triangles.reduce((sum, [x,y,z,a,b,c,p,q,r]) => sum + (x*(b*r-c*q)+y*(c*p-a*r)+z*(a*q-b*p))/6, 0);
}
function components(triangles: Triangle[]) {
  const vertexIds = new Map<string, number>(), parent: number[] = [];
  const find = (start: number): number => {
    let current = start;
    while (parent[current] !== current) { parent[current] = parent[parent[current]]; current = parent[current]; }
    return current;
  };
  const id = (point: number[]) => {
    const key = point.map(value => value.toFixed(3)).join(",");
    if (!vertexIds.has(key)) { vertexIds.set(key, parent.length); parent.push(parent.length); }
    return vertexIds.get(key)!;
  };
  for (const triangle of triangles) {
    const ids = [id(triangle.slice(0,3)),id(triangle.slice(3,6)),id(triangle.slice(6,9))];
    parent[find(ids[1])] = find(ids[0]);
    parent[find(ids[2])] = find(ids[0]);
  }
  return new Set(parent.map((_, index) => find(index))).size;
}
function covers(triangles: Triangle[], x: number, y: number, z: number) {
  return triangles.some(([ax,ay,az,bx,by,bz,cx,cy,cz]) => {
    if (az !== z || bz !== z || cz !== z) return false;
    const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/determinant;
    const b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/determinant;
    return a>=0 && b>=0 && a+b<=1;
  });
}

describe("made-to-order keychain",()=>{
  it("fits longer names by reducing glyph height while keeping a watertight two-part mesh",()=>{
    const short=generateKeychain({...choices,name:"Daniel"}),long=generateKeychain({...choices,name:"Christopher"});
    expect(long.letterHeightMm).toBeLessThan(short.letterHeightMm);
    expect(long.widthMm).toBeLessThanOrEqual(90.4);
    expect(watertight(long.base)).toBe(true);
    expect(watertight(long.letters)).toBe(true);
    expect(signedVolume(long.base)).toBeGreaterThan(0);
    expect(signedVolume(long.letters)).toBeGreaterThan(0);
    expect(long.base.reduce((height, t) => Math.max(height, t[2], t[5], t[8]), 0)).toBe(3.5);
    expect(long.letters.reduce((height, t) => Math.max(height, t[2], t[5], t[8]), 0)).toBe(4.5);
    expect(long.base.some(t => t[2] !== t[5] && t[0] !== t[3] && t[1] !== t[4])).toBe(true);
  });
  it("rejects unprintable combinations and preserves the size limit",()=>{
    const medium=generateKeychain({...choices,name:"Daniel",size:"medium"});
    expect(medium.letterHeightMm).toBe(15);
    expect(medium.widthMm).toBeLessThanOrEqual(110.2);
    expect(()=>generateKeychain({...choices,name:"Maximilian Alexander"})).toThrow(/too long/);
    expect(()=>generateKeychain({...choices,name:"Daniel",letterColour:"peach"})).toThrow(/different/);
    expect(()=>generateKeychain({...choices,name:"<script>"})).toThrow();
  });
  it("keeps a continuous backing for each shape and size, with the raised name aligned",()=>{
    for (const size of ["regular","medium","large"] as const) {
      const contour=generateKeychain({...choices,name:"Daniel",size,baseShape:"contour"});
      const rectangle=generateKeychain({...choices,name:"Daniel",size,baseShape:"rectangle"});
      expect(components(contour.base)).toBe(1);
      expect(components(rectangle.base)).toBe(1);
      expect(watertight(rectangle.base)).toBe(true);
      expect(watertight(rectangle.letters)).toBe(true);
      expect(rectangle.base).not.toEqual(contour.base);
      expect(rectangle.letterHeightMm).toBe(contour.letterHeightMm);
      expect(rectangle.letters).toEqual(contour.letters);
    }
    expect(()=>generateKeychain({...choices,name:"Daniel",baseShape:"star" as "contour"})).toThrow(/shape/);
  }, 30000);
  it("exports STL geometry and a 3MF with aligned parts",()=>{
    const input={...choices,name:"Daniel"},model=generateKeychain(input),stl=binaryStl(model.base),mf=keychain3mf(input);
    expect(stl.readUInt32LE(80)).toBe(model.base.length);
    expect(stl.length).toBe(84+model.base.length*50);
    expect(mf.readUInt32LE(0)).toBe(0x04034b50);
    let offset=0,xml="",settings="";
    while(mf.readUInt32LE(offset)===0x04034b50){
      const nameLength=mf.readUInt16LE(offset+26),length=mf.readUInt32LE(offset+18),start=offset+30+nameLength;
      const name=mf.subarray(offset+30,start).toString("utf8");
      if(name==="3D/3dmodel.model")xml=inflateRawSync(mf.subarray(start,start+length)).toString("utf8");
      if(name==="Metadata/project_settings.config")settings=inflateRawSync(mf.subarray(start,start+length)).toString("utf8");
      offset=start+length;
    }
    expect(xml).toContain('<component objectid="2"/>');
    expect(xml).toContain('<component objectid="3"/>');
    expect(JSON.parse(settings)).toMatchObject({ printer_model: "Bambu Lab X2D", ironing_type: "top", ironing_pattern: "zig-zag", ironing_speed: "80", ironing_flow: "30%" });
  });
  it("scales the outline with the letters and offers a solid tag without the keyring hole",()=>{
    const regular=generateKeychain({...choices,name:"Name",attachment:"tag"});
    const large=generateKeychain({...choices,name:"Name",size:"large",attachment:"tag"});
    const loop=generateKeychain({...choices,name:"Name",attachment:"keychain"});
    expect(components(regular.base)).toBe(1);
    expect(components(large.base)).toBe(1);
    expect(components(loop.base)).toBe(1);
    expect(large.heightMm).toBeGreaterThan(regular.heightMm * 1.7);
    expect(watertight(large.base)).toBe(true);
    expect(loop.widthMm).toBeGreaterThan(regular.widthMm + 2);
    expect(()=>generateKeychain({...choices,name:"Name",attachment:"clip" as "tag"})).toThrow(/tag/);
  },30000);
  it("fills counters and gaps under all names while keeping the keyring hole open",()=>{
    const daniel=generateKeychain({...choices,name:"Daniel",attachment:"tag"});
    const yuliany=generateKeychain({...choices,name:"Yuliany",attachment:"tag"});
    expect(covers(daniel.base,3.5,5,3.5)).toBe(true); // Inside D
    expect(covers(daniel.letters,3.5,5,4.5)).toBe(false);
    expect(covers(yuliany.base,2.5,4,3.5)).toBe(true); // Between Y and u
    for(const font of ["rounded","classic","mono"] as const){
      const model=generateKeychain({...choices,name:"Amelia",font,attachment:"tag"});
      expect(components(model.base)).toBe(1);
      expect(watertight(model.base)).toBe(true);
    }
  },30000);
});
