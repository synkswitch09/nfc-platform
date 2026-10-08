"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export function AccountProfileForm({name,email,phone}:{name:string;email:string;phone:string|null}) {
 const router=useRouter();const [message,setMessage]=useState("");const [pending,setPending]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setPending(true);const data=new FormData(e.currentTarget);try{const response=await fetch("/api/account/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({name:data.get("name"),phone:String(data.get("phone")??"")||null})});const result=await response.json();setMessage(response.ok?"Profile updated":result.error);if(response.ok)router.refresh();}catch{setMessage("Please try again.");}finally{setPending(false);}}
 return <form className="card form" onSubmit={submit}><h2>Personal details</h2><label className="field">Full name<input name="name" defaultValue={name} minLength={2} maxLength={80} required /></label><label className="field">Phone<input name="phone" type="tel" defaultValue={phone??""} maxLength={40}/></label><label className="field">Email<input value={email} readOnly /></label><p className="fine-print">Your verified email identifies your account and cannot be changed here.</p><button className="button" disabled={pending}>Save details</button>{message&&<p role="status">{message}</p>}</form>;
}
