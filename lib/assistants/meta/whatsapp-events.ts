import { z } from "zod";
import { metaId,metaConfig } from "./security";
import type { MetaIncoming } from "./events";
const rec=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
const list=(x:unknown)=>Array.isArray(x)?x.slice(0,1000):[];
const messageId=(x:unknown):x is string=>typeof x==="string"&&x.length>0&&x.length<=1000;
const date=(x:unknown)=>new Date(typeof x==="string"&&/^\d{1,12}$/.test(x)?Number(x)*1000:typeof x==="number"?x*1000:NaN);
export type WhatsAppUpdate={wabaId:string;event:string;occurredAt:Date};
export function parseWhatsApp(payload:unknown):{events:MetaIncoming[];updates:WhatsAppUpdate[]}{
 const root=z.object({object:z.literal("whatsapp_business_account"),entry:z.array(z.object({id:z.string(),time:z.number().optional(),changes:z.array(z.unknown()).max(1000)})).max(1000)}).parse(payload),events:MetaIncoming[]=[],updates:WhatsAppUpdate[]=[];
 for(const entry of root.entry)for(const raw of entry.changes){const change=rec(raw),v=rec(change.value);
  if(change.field==="account_update"){
   const info=rec(v.waba_info),wabaId=info.waba_id||entry.id;
   if(metaId(wabaId)&&["PARTNER_APP_UNINSTALLED","PARTNER_REMOVED","ACCOUNT_DELETED","ACCOUNT_OFFBOARDED","DISABLED_UPDATE"].includes(String(v.event))&&(v.event!=="PARTNER_APP_UNINSTALLED"||info.partner_app_id===metaConfig().appId))updates.push({wabaId,event:String(v.event),occurredAt:new Date((entry.time||0)*1000)});continue;
  }
  const metadata=rec(v.metadata);if(v.messaging_product!=="whatsapp"||!metaId(metadata.phone_number_id)||!metaId(entry.id))continue;const accountId=metadata.phone_number_id;
  if(change.field==="messages"){
   for(const rawMessage of list(v.messages)){const m=rec(rawMessage);if(!metaId(m.from)||!messageId(m.id)||m.group_id||m.type==="reaction"||m.type==="system"||m.type==="revoke")continue;
    const text=rec(m.text).body,supported=m.type==="text"&&typeof text==="string"&&Boolean(text.trim());events.push({provider:"WHATSAPP",accountId,scopeId:entry.id,eventKey:`message:${m.id}`,kind:supported?"MESSAGE":"HANDOFF",contactId:m.from,targetId:m.from,text:supported?(text as string).slice(0,10000):"[WhatsApp attachment or unsupported message — review in WhatsApp]",occurredAt:date(m.timestamp)});
   }
   for(const rawStatus of list(v.statuses)){const s=rec(rawStatus);if(!messageId(s.id)||!metaId(s.recipient_id)||!["sent","delivered","read","failed"].includes(String(s.status)))continue;events.push({provider:"WHATSAPP",accountId,scopeId:entry.id,eventKey:`status:${s.id}:${s.status}`,kind:"DELIVERY",contactId:s.recipient_id,targetId:s.id,text:String(s.status).toUpperCase(),occurredAt:date(s.timestamp)});}
  }else if(change.field==="smb_message_echoes"){
   for(const rawEcho of list(v.message_echoes)){const m=rec(rawEcho),contact=typeof m.to==="string"?m.to.replace(/^\+/,""):"";if(!metaId(contact)||!messageId(m.id))continue;events.push({provider:"WHATSAPP",accountId,scopeId:entry.id,eventKey:`message:${m.id}`,kind:"ECHO",contactId:contact,targetId:contact,text:typeof rec(m.text).body==="string"?String(rec(m.text).body).slice(0,10000):"[Business replied in WhatsApp]",occurredAt:date(m.timestamp)});}
  }
 }
 return {events,updates};
}
