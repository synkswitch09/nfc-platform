import { generateKeychain, KEYCHAIN_COLOURS, type KeychainInput, type Triangle } from "./keychain";
import { deflateRawSync } from "node:zlib";
import bambuProfile from "./bambu-x2d-pla-profile.json";

export function binaryStl(triangles: Triangle[]) {
  const bytes = Buffer.alloc(84 + triangles.length * 50);
  bytes.write("Kosykin name keychain", 0, "ascii"); bytes.writeUInt32LE(triangles.length, 80);
  for (let i=0;i<triangles.length;i++) {
    const t=triangles[i], a=[t[3]-t[0],t[4]-t[1],t[5]-t[2]], b=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];
    const n=[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const length=Math.hypot(...n)||1, offset=84+i*50;
    for(let k=0;k<3;k++) bytes.writeFloatLE(n[k]/length,offset+k*4);
    for(let k=0;k<9;k++) bytes.writeFloatLE(t[k],offset+12+k*4);
  }
  return bytes;
}

function crc32(buffer: Buffer) {
  let crc=-1;
  for(const byte of buffer){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  return (crc^-1)>>>0;
}

function zip(files: {name:string; content: Buffer}[]) {
  const local: Buffer[]=[], central: Buffer[]=[]; let offset=0;
  for(const {name,content} of files){
    const filename=Buffer.from(name), sum=crc32(content), header=Buffer.alloc(30), directory=Buffer.alloc(46), compressed=content.length>1000?deflateRawSync(content):content, method=compressed===content?0:8;
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(method,8);header.writeUInt32LE(sum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(filename.length,26);
    directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(method,10);directory.writeUInt32LE(sum,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(content.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,filename,compressed);central.push(directory,filename);offset+=header.length+filename.length+compressed.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0), end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}

function xmlEscape(s: string) { return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"); }

export function keychain3mf(input: KeychainInput) {
  const model=generateKeychain(input);
  const parts=[{name:"Base",triangles:model.base,extruder:1},...(model.baseCap.length?[{name:"Base top",triangles:model.baseCap,extruder:1}]:[]),{name:"Letters",triangles:model.letters,extruder:2}];
  const objects=parts.map(({triangles},index)=>{
    const vertices:string[]=[], faces:string[]=[], ids=new Map<string,number>();
    for(const t of triangles){const face:number[]=[];for(let i=0;i<9;i+=3){const p=t.slice(i,i+3);const key=p.join(",");let id=ids.get(key);if(id===undefined){id=ids.size;ids.set(key,id);vertices.push(`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`)}face.push(id)}faces.push(`<triangle v1="${face[0]}" v2="${face[1]}" v3="${face[2]}"/>`)}
    return `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"><resources><object id="${index+2}" type="model"><mesh><vertices>${vertices.join("")}</vertices><triangles>${faces.join("")}</triangles></mesh></object></resources><build><item objectid="${index+2}"/></build></model>`;
  });
  const objectId=parts.length+2;
  const components=parts.map((_,index)=>`<component p:path="/3D/Objects/object_${index+2}.model" objectid="${index+2}"/>`).join("");
  const xml=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" requiredextensions="p"><metadata name="Application">BambuStudio-02.08.02.61</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="Title">Kosykin ${xmlEscape(input.name)}</metadata><resources><object id="${objectId}" type="model"><components>${components}</components></object></resources><build><item objectid="${objectId}" printable="1"/></build></model>`;
  // Bambu Studio uses "top" for every exposed top surface (base and raised letters);
  // "topmost" would iron only the highest surface.
  const profile = { ...bambuProfile, ironing_type: "top", filament_colour: [(input.palette ?? KEYCHAIN_COLOURS)[input.baseColour], (input.palette ?? KEYCHAIN_COLOURS)[input.letterColour], ...bambuProfile.filament_colour.slice(2)] };
  const partSettings=parts.map((part,index)=>`<part id="${index+2}" subtype="normal_part"><metadata key="name" value="${part.name}"/><metadata key="extruder" value="${part.extruder}"/></part>`).join("");
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?><config><object id="${objectId}"><metadata key="name" value="Kosykin ${xmlEscape(input.name)}"/><metadata key="extruder" value="1"/>${partSettings}</object><plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="${objectId}"/><metadata key="instance_id" value="0"/></model_instance></plate></config>`;
  const modelRels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${parts.map((_,index)=>`<Relationship Target="/3D/Objects/object_${index+2}.model" Id="rel-${index+1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`).join("")}</Relationships>`;
  return zip([
    {name:"[Content_Types].xml",content:Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')},
    {name:"_rels/.rels",content:Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')},
    {name:"3D/3dmodel.model",content:Buffer.from(xml)},
    {name:"3D/_rels/3dmodel.model.rels",content:Buffer.from(modelRels)},
    ...objects.map((object,index)=>({name:`3D/Objects/object_${index+2}.model`,content:Buffer.from(object)})),
    {name:"Metadata/model_settings.config",content:Buffer.from(modelSettings)},
    {name:"Metadata/project_settings.config",content:Buffer.from(JSON.stringify(profile))},
    {name:"Metadata/slice_info.config",content:Buffer.from('<?xml version="1.0" encoding="UTF-8"?><config><header><header_item key="X-BBL-Client-Type" value="slicer"/><header_item key="X-BBL-Client-Version" value="02.08.02.61"/></header></config>')},
  ]);
}
