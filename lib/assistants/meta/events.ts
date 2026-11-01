import { z } from "zod";
import { metaId,type SocialProvider } from "./security";
export type MetaIncoming={provider:SocialProvider;accountId:string;eventKey:string;kind:"MESSAGE"|"COMMENT"|"HANDOFF"|"ECHO";contactId:string;targetId:string;text:string;occurredAt:Date};
const envelope=z.object({object:z.string(),entry:z.array(z.object({id:z.string(),time:z.number().optional(),messaging:z.array(z.unknown()).max(1000).optional(),changes:z.array(z.unknown()).max(1000).optional()})).max(1000)});
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
function timestamp(value:unknown,fallback:number|undefined){const n=typeof value==="number"?value:typeof value==="string"?Date.parse(value):NaN;const date=new Date(Number.isFinite(n)?n<1e12?n*1000:n:(fallback||0)*1000);return date;}
export function parseMetaEvents(payload:unknown):MetaIncoming[]{
 const parsed=envelope.parse(payload);if(!["page","instagram"].includes(parsed.object))return [];const provider=parsed.object==="page"?"FACEBOOK":"INSTAGRAM",out:MetaIncoming[]=[];
 for(const entry of parsed.entry){if(!metaId(entry.id))continue;
  for(const raw of entry.messaging||[]){const e=record(raw),sender=record(e.sender),recipient=record(e.recipient),message=record(e.message);if(!metaId(sender.id)||!metaId(recipient.id)||typeof message.mid!=="string"||message.mid.length>1000||message.is_deleted||message.is_self)continue;const echo=message.is_echo===true||sender.id===entry.id;
   if(!echo&&recipient.id!==entry.id)continue;const contactId=(echo?recipient.id:sender.id) as string,text=typeof message.text==="string"?message.text.trim():"",unsupported=Boolean(message.attachments)||message.is_unsupported===true||!text;
   out.push({provider,accountId:entry.id,eventKey:`message:${message.mid}`,kind:echo?"ECHO":unsupported?"HANDOFF":"MESSAGE",contactId,targetId:contactId,text:unsupported?"[Attachment or unsupported message — review in Meta]":text.slice(0,10000),occurredAt:timestamp(e.timestamp,entry.time)});
  }
  for(const raw of entry.changes||[]){const e=record(raw),v=record(e.value),from=record(v.from);if(!metaId(from.id)||from.id===entry.id)continue;
   if(provider==="FACEBOOK"){if(e.field!=="feed"||v.item!=="comment"||v.verb!=="add"||typeof v.comment_id!=="string"||!/^\d+(?:_\d+)?$/.test(v.comment_id)||typeof v.post_id!=="string"||!v.post_id.startsWith(`${entry.id}_`)||v.parent_id!==v.post_id||typeof v.message!=="string"||!v.message.trim())continue;out.push({provider,accountId:entry.id,eventKey:`comment:${v.comment_id}`,kind:"COMMENT",contactId:from.id,targetId:v.comment_id,text:v.message.slice(0,10000),occurredAt:timestamp(v.created_time,entry.time)});
   }else{if(e.field!=="comments"||!metaId(v.id)||v.parent_id||typeof v.text!=="string"||!v.text.trim())continue;out.push({provider,accountId:entry.id,eventKey:`comment:${v.id}`,kind:"COMMENT",contactId:from.id,targetId:v.id,text:v.text.slice(0,10000),occurredAt:timestamp(v.timestamp,entry.time)});}
  }
 }
 return out;
}
export function messageWindowOpen(last:Date|null,now=new Date()){return Boolean(last&&last.getTime()<=now.getTime()+5*60000&&now.getTime()-last.getTime()<24*3600000);}
export function needsHuman(text:string){return /\b(refund|complaint|complain|lawyer|lawsuit|chargeback|scam|fraud|human|speak to (someone|a person)|devoluci[oó]n|reembolso|queja|reclamo|humano|persona real)\b/i.test(text);}
