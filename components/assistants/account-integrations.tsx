"use client";
import { useState } from "react";
type Model = { name: string; modelId: string; enabled: boolean };
export function AccountIntegrations({ userId, email, models, anthropicConfigured }: { userId: string; email: string; models: Model[]; anthropicConfigured: boolean }) {
  const [copied, setCopied] = useState("");
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied("Copied to clipboard."); }
    catch { setCopied("Select and copy the value manually."); }
  }
  return <section className="ai-card"><p className="ai-eyebrow">Your account · Private administrator details</p><h1 style={{ fontSize: 36 }}>Integration details</h1><p>Signed in as <strong>{email}</strong>. These are identifiers, not API secrets.</p>
    <h2>Trading owner</h2><p>Use your existing account ID for <code>TRADING_OWNER_USER_ID</code>. Your Google sign-in uses this same account when the verified email matches.</p>
    <label className="ai-field">Your internal user ID<input readOnly value={userId} onFocus={e => e.currentTarget.select()}/></label><button className="ai-button ai-secondary" onClick={() => void copy(userId)}>Copy user ID</button>
    <h2 style={{ marginTop: 30 }}>Configured Claude models</h2><p>{anthropicConfigured ? "An Anthropic API key is configured on this server. The connection has not been tested by this page." : "The Anthropic API key is not configured on this server."} Use the exact model ID for <code>TRADING_AI_MODEL</code>.</p>
    <p className="ai-small">These are the effective models in this deployment, including any server overrides. Configuration does not guarantee the provider still supports a model or grants access to your key.</p>
    {models.map(model => <div key={model.modelId + model.name} style={{ marginBottom: 20 }}><label className="ai-field">{model.name}{model.enabled ? "" : " · Disabled"}<input readOnly value={model.modelId} onFocus={e => e.currentTarget.select()}/></label><button className="ai-button ai-secondary" onClick={() => void copy(model.modelId)}>Copy model ID</button></div>)}
    {copied && <p className="ai-status" role="status">{copied}</p>}
  </section>;
}
