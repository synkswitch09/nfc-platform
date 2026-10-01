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
  it("exports STL geometry and a 3MF with aligned parts",()=>{
    const input={...choices,name:"Daniel"},model=generateKeychain(input),stl=binaryStl(model.base),mf=keychain3mf(input);
    expect(stl.readUInt32LE(80)).toBe(model.base.length);
    expect(stl.length).toBe(84+model.base.length*50);
    expect(mf.readUInt32LE(0)).toBe(0x04034b50);
    let offset=0,xml="";
    while(mf.readUInt32LE(offset)===0x04034b50){
      const nameLength=mf.readUInt16LE(offset+26),length=mf.readUInt32LE(offset+18),start=offset+30+nameLength;
      const name=mf.subarray(offset+30,start).toString("utf8");
      if(name==="3D/3dmodel.model")xml=inflateRawSync(mf.subarray(start,start+length)).toString("utf8");
      offset=start+length;
    }
    expect(xml).toContain('<component objectid="2"/>');
    expect(xml).toContain('<component objectid="3"/>');
  });
});
