"use client";
import { useAdminRequest } from "@/components/admin-form-feedback";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function TeamRoleForm({ userId, role }: { userId: string; role: string }) {
  const { request: adminRequest, feedbackRef, feedback } = useAdminRequest();

  const router = useRouter(); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await adminRequest(`/api/admin/team/${userId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: form.get("role") }) }); const result = await response.json().catch(() => ({})); if (!response.ok) return setMessage(result.error ?? "Role could not be updated"); setMessage("Updated"); router.refresh(); }
  return <form ref={node => { feedbackRef.current = node; }} className="role-form" onSubmit={submit}>{feedback}<select name="role" defaultValue={role}><option>CUSTOMER</option><option>STAFF</option><option>ADMIN</option></select><button className="button secondary">Save</button>{message && <small>{message}</small>}</form>;
}
