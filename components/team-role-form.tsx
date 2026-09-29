"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function TeamRoleForm({ userId, role }: { userId: string; role: string }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch(`/api/admin/team/${userId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: form.get("role") }) }); const result = await response.json().catch(() => ({})); if (!response.ok) return setMessage(result.error ?? "Role could not be updated"); setMessage("Updated"); router.refresh(); }
  return <form className="role-form" onSubmit={submit}><select name="role" defaultValue={role}><option>CUSTOMER</option><option>STAFF</option><option>ADMIN</option></select><button className="button secondary">Save</button>{message && <small>{message}</small>}</form>;
}
