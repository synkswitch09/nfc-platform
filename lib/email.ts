export async function sendTransactionalEmail(input: { to: string; subject: string; text: string }) {
  const url = process.env.EMAIL_WEBHOOK_URL;
  if (!url) { if (process.env.NODE_ENV !== "production") console.info(`[email preview] ${input.subject}: ${input.text}`); return false; }
  const response = await fetch(url, { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${process.env.EMAIL_WEBHOOK_SECRET ?? ""}`}, body:JSON.stringify(input) });
  if (!response.ok) throw new Error("Email delivery failed");
  return true;
}
