"use client";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
type Prepared={flowId:string;state:string;appId:string;configId:string;version:string};
type FacebookSdk={init:(settings:Record<string,unknown>)=>void;login:(callback:(response:{authResponse?:{code?:string}})=>void,options:Record<string,unknown>)=>void};
let sdkPromise:Promise<FacebookSdk>|undefined;
function loadSdk(){
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise<FacebookSdk>((resolve,reject)=>{
  const globals=window as typeof window&{FB?:FacebookSdk};if(globals.FB){resolve(globals.FB);return;}
  const script=document.createElement("script");script.src="https://connect.facebook.net/en_US/sdk.js";script.async=true;script.crossOrigin="anonymous";
  script.onload=()=>{if(globals.FB)resolve(globals.FB);else{sdkPromise=undefined;script.remove();reject(new Error("Meta could not load. Please try again."));}};
  script.onerror=()=>{sdkPromise=undefined;script.remove();reject(new Error("Meta could not load. Check your connection and browser settings."));};document.head.appendChild(script);
 });return sdkPromise;
}
export function WhatsAppSignup({workspaceId,ready,reconnect}:{workspaceId:string;ready:boolean;reconnect:boolean}){
 const router=useRouter(),[prepared,setPrepared]=useState<Prepared|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),active=useRef(false),wabaId=useRef<string|undefined>(undefined),mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;const listener=(event:MessageEvent)=>{
   if(!active.current||!["https://www.facebook.com","https://web.facebook.com","https://business.facebook.com"].includes(event.origin)||typeof event.data!=="string"||event.data.length>20000)return;
   try{const value=JSON.parse(event.data);if(value.type==="WA_EMBEDDED_SIGNUP"&&value.event==="FINISH"&&typeof value.data?.waba_id==="string"&&/^\d{1,40}$/.test(value.data.waba_id))wabaId.current=value.data.waba_id;}catch{/* Non-signup SDK events do not carry account selection. */}
  };window.addEventListener("message",listener);return()=>{mounted.current=false;active.current=false;window.removeEventListener("message",listener);};
 },[]);
 async function post(data:unknown){const response=await fetch(`/api/assistants/workspaces/${workspaceId}/meta`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}),result=await response.json();if(!response.ok)throw new Error(result.error||"Please try again.");return result;}
 async function prepare(){setBusy(true);setStatus("");try{const result=await post({action:"whatsapp-start"}) as Prepared;const sdk=await loadSdk();sdk.init({appId:result.appId,version:result.version,autoLogAppEvents:false,xfbml:false});setPrepared(result);setStatus("Ready. Continue with Meta to authorise your WhatsApp business and number.");}catch(error){setStatus(error instanceof Error?error.message:"Please try again.");}finally{setBusy(false);}}
 function launch(){
  const sdk=(window as typeof window&{FB?:FacebookSdk}).FB;if(!prepared||!sdk)return;active.current=true;wabaId.current=undefined;setBusy(true);setStatus("Complete the connection in Meta, then return here.");
  // FB.login must run directly in a user click to avoid popup blocking. This
  // second button follows the async SDK/server preparation step.
  try{sdk.login(response=>{void(async()=>{try{
   if(!mounted.current)return;const code=response.authResponse?.code;if(!code)throw new Error("The connection was cancelled. You can try again when ready.");
   // Exchange promptly: Meta's exchangeable code expires after 30 seconds.
   await post({action:"whatsapp-authorize",flowId:prepared.flowId,state:prepared.state,code,...(wabaId.current?{wabaId:wabaId.current}:{})});if(!mounted.current)return;setStatus("Authorised. Choose your business number below to finish connecting.");setPrepared(null);router.refresh();
  }catch(error){if(mounted.current){setPrepared(null);setStatus(error instanceof Error?error.message:"Please try again.");}}finally{active.current=false;if(mounted.current)setBusy(false);}})();},{config_id:prepared.configId,response_type:"code",override_default_response_type:true,extras:{setup:{}}});}
  catch{active.current=false;setBusy(false);setStatus("Meta could not open. Allow popups for this site and try again.");}
 }
 return <div style={{marginTop:20}}><p className="ai-small">Use a dedicated WhatsApp Business Platform number. Connecting an existing WhatsApp Business app number while keeping the app is not supported in this release.</p>{prepared?<button type="button" className="ai-button" disabled={busy||!ready} onClick={launch}>Continue with Meta</button>:<button type="button" className="ai-button ai-secondary" disabled={busy||!ready} onClick={()=>void prepare()}>{reconnect?"Reconnect WhatsApp":"Connect WhatsApp"}</button>}{status&&<p role="status" className="ai-small">{status}</p>}</div>;
}
