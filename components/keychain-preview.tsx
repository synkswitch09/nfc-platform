"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateKeychain, KEYCHAIN_COLOURS, type KeychainInput, type Triangle } from "@/lib/keychain";

function geometry(triangles: Triangle[]) {
  const data = new Float32Array(triangles.length * 18);
  triangles.forEach((t, index) => {
    const a=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],b=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const magnitude=Math.hypot(...n)||1;
    for(let vertex=0;vertex<3;vertex++) for(let k=0;k<3;k++){
      data[index*18+vertex*6+k]=t[vertex*3+k];
      data[index*18+vertex*6+3+k]=n[k]/magnitude;
    }
  });
  return data;
}

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const result=gl.createShader(type); if(!result) throw new Error("3D preview unavailable");
  gl.shaderSource(result,source);gl.compileShader(result);
  if(!gl.getShaderParameter(result,gl.COMPILE_STATUS)) throw new Error("3D preview unavailable");
  return result;
}

export function KeychainPreview({ input }: { input: KeychainInput }) {
  const canvas=useRef<HTMLCanvasElement>(null), angles=useRef({x:0.48,y:-0.28}), pointer=useRef<{x:number;y:number}|null>(null), drawRef=useRef<()=>void>(()=>{});
  const [webglError,setWebglError]=useState(false);
  const result=useMemo(()=>{try{return {model:generateKeychain(input),error:""}}catch(error){return {model:null,error:error instanceof Error?error.message:"Invalid keychain"}}},[input.name,input.font,input.size,input.baseShape,input.attachment,input.letterFinish,input.baseColour,input.letterColour]);
  useEffect(()=>{
    const element=canvas.current, model=result.model; if(!element||!model)return;
    const gl=element.getContext("webgl",{antialias:true,alpha:false});if(!gl){setWebglError(true);return}
    try {
      const program=gl.createProgram();if(!program)throw new Error("3D preview unavailable");
      gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,`attribute vec3 position;attribute vec3 normal;uniform vec2 angles;uniform vec3 origin;uniform float scale;uniform float aspect;varying float light;void main(){vec3 p=position-origin;float cy=cos(angles.y),sy=sin(angles.y),cx=cos(angles.x),sx=sin(angles.x);vec3 q=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);q=vec3(q.x,q.y*cx-q.z*sx,q.y*sx+q.z*cx);vec3 n=vec3(normal.x*cy+normal.z*sy,normal.y,-normal.x*sy+normal.z*cy);n=vec3(n.x,n.y*cx-n.z*sx,n.y*sx+n.z*cx);light=0.58+0.42*max(dot(normalize(n),normalize(vec3(-0.4,0.6,1.0))),0.0);gl_Position=vec4(q.x*scale,q.y*scale*aspect,-q.z*0.002,1.0);}`));
      gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,`precision mediump float;uniform vec3 colour;varying float light;void main(){gl_FragColor=vec4(colour*light,1.0);}`));
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error("3D preview unavailable");gl.useProgram(program);
      const position=gl.getAttribLocation(program,"position"),normal=gl.getAttribLocation(program,"normal");
      const buffers=[{triangles:model.base,colour:input.baseColour},{triangles:model.baseCap,colour:input.baseColour},{triangles:model.letters,colour:input.letterColour}].map(({triangles,colour})=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,geometry(triangles),gl.STATIC_DRAW);return {buffer,count:triangles.length*3,colour}});
      const draw=()=>{
        const width=element.clientWidth||500,height=element.clientHeight||330,dpr=Math.min(devicePixelRatio||1,2);
        element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);gl.viewport(0,0,element.width,element.height);
        gl.clearColor(0.97,0.96,0.94,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);
        gl.uniform2f(gl.getUniformLocation(program,"angles"),angles.current.x,angles.current.y);
        gl.uniform3f(gl.getUniformLocation(program,"origin"),model.centreX,model.centreY,2);
        gl.uniform1f(gl.getUniformLocation(program,"scale"),Math.min(1.65/model.widthMm,1.45/(model.heightMm*(width/height))));
        gl.uniform1f(gl.getUniformLocation(program,"aspect"),width/height);
        buffers.forEach(item=>{const value=KEYCHAIN_COLOURS[item.colour],rgb=[1,3,5].map(start=>parseInt(value.slice(start,start+2),16)/255);gl.uniform3f(gl.getUniformLocation(program,"colour"),rgb[0],rgb[1],rgb[2]);gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(normal);gl.drawArrays(gl.TRIANGLES,0,item.count)});
      };
      drawRef.current=draw;draw();const observer=new ResizeObserver(draw);observer.observe(element);
      return()=>{observer.disconnect();drawRef.current=()=>{};buffers.forEach(item=>gl.deleteBuffer(item.buffer));gl.deleteProgram(program)};
    }catch{setWebglError(true)}
  },[result.model,input.baseColour,input.letterColour]);
  return <div className="keychain-preview">
    {result.error?<div className="keychain-preview-error" role="status">{result.error}</div>:<>
      {webglError?<div className="keychain-preview-error">3D preview is unavailable on this device. Your selected details remain in the form.</div>:<canvas ref={canvas} aria-label={`3D preview of ${input.name || "your name"} keychain`} onPointerDown={event=>{pointer.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={event=>{if(!pointer.current)return;angles.current.y+=(event.clientX-pointer.current.x)*0.012;angles.current.x=Math.max(-1.4,Math.min(1.4,angles.current.x+(event.clientY-pointer.current.y)*0.012));pointer.current={x:event.clientX,y:event.clientY};drawRef.current()}} onPointerUp={()=>{pointer.current=null}} />}
      <p>Drag to rotate · {result.model?.widthMm} × {result.model?.heightMm} × 4 mm · {input.letterFinish === "inlaid" ? "Flush letters" : "Raised letters"} {result.model?.letterHeightMm} mm high</p>
    </>}
  </div>;
}
