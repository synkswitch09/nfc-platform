import {z} from "zod";
export const savedCartSchema=z.array(z.object({variantId:z.string().uuid(),quantity:z.number().int().min(1).max(10),personalisationChoice:z.enum(["BASIC","PERSONALISED"]),personalisation:z.record(z.string().max(80),z.string().max(200)).refine(v=>Object.keys(v).length<=30)})).max(50);
export type SavedCartLine=z.infer<typeof savedCartSchema>[number];
export function savedLineKey(line:SavedCartLine){return `${line.variantId}:${line.personalisationChoice}:${JSON.stringify(Object.entries(line.personalisation).sort(([a],[b])=>a.localeCompare(b)))}`;}
export function mergeSavedCart(remote:SavedCartLine[],local:SavedCartLine[]){const merged=new Map(remote.map(line=>[savedLineKey(line),line]));for(const line of local){const key=savedLineKey(line);const found=merged.get(key);merged.set(key,{...line,quantity:Math.max(line.quantity,found?.quantity??0)});}return [...merged.values()].slice(0,50);}
