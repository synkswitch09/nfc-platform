'use client';
import { MAX_BUSINESS_KNOWLEDGE } from '@/lib/assistants/knowledge';
import { useState } from 'react';
import type { WebsiteImport } from '@/lib/assistants/website-import';

export function AssistantKnowledgeInput({ workspaceId, initialKnowledge, disabled, onImportingChange }: { workspaceId: string; initialKnowledge: string; disabled: boolean; onImportingChange: (value: boolean) => void }) {
  const savedWebsite = initialKnowledge.match(/^Website source: (https:\/\/\S+)/)?.[1] || '';
  const [mode, setMode] = useState<'website' | 'manual'>(!initialKnowledge || savedWebsite ? 'website' : 'manual');
  const [url, setUrl] = useState(savedWebsite);
  const [knowledge, setKnowledge] = useState(initialKnowledge);
  const [imported, setImported] = useState<WebsiteImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function importWebsite() {
    setError(''); setNotice('');
    if (!url.trim()) { setError('Enter your website address first.'); return; }
    setBusy(true); onImportingChange(true);
    try {
      const response = await fetch(`/api/assistants/workspaces/${workspaceId}/import-website`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ websiteUrl: url }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not read this website. Try again or choose I do not have a website.');
      const data = result as WebsiteImport;
      setImported(data); setUrl(data.websiteUrl);
      if (!knowledge.trim()) {
        setKnowledge(data.knowledge);
        setNotice('Your website information is ready. Review it below, save the draft and publish when ready.');
      } else {
        setNotice('New import ready — NOT saved or published. Choose Replace draft with this import below, then Save & publish to update customer replies. Your current information has been kept.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not read the website.'); }
    finally { setBusy(false); onImportingChange(false); }
  }
  return <fieldset className="ai-knowledge-input" disabled={disabled || busy} style={{ margin: '24px 0', padding: 0, border: 0 }}>
    <legend style={{ fontWeight: 700, marginBottom: 12 }}>Where should your assistant learn about your business?</legend>
    <div className="ai-actions" style={{ margin: '0 0 20px' }}>
      <label className="ai-check"><input type="radio" name="knowledgeSource" checked={mode === 'website'} onChange={() => { setMode('website'); setError(''); }} />I have a website</label>
      <label className="ai-check"><input type="radio" name="knowledgeSource" checked={mode === 'manual'} onChange={() => { setMode('manual'); setError(''); }} />I do not have a website</label>
    </div>
    {mode === 'website' && <>
      <label className="ai-field">Your website address<input type="text" inputMode="url" autoComplete="url" value={url} maxLength={2048} onChange={event => { setUrl(event.target.value); setError(''); }} placeholder="https://yourbusiness.com.au" aria-invalid={Boolean(error)} aria-describedby={error ? 'assistant-website-error' : 'assistant-website-help'} /></label>
      <p className="ai-small" id="assistant-website-help">We read public FAQs, products, services and policies. You can review and correct the result before publishing. No AI credits are used for the import.</p>
      <button type="button" className="ai-button ai-secondary" disabled={disabled || busy} onClick={() => void importWebsite()}>{busy ? 'Reading your website…' : savedWebsite ? 'Refresh website information' : 'Read my website'}</button>
      {error && <p id="assistant-website-error" className="ai-status" role="alert">{error}</p>}
      {notice && <p className="ai-status" role="status">{notice}</p>}
      {imported && <div className="ai-import-summary" style={{ marginTop: 20 }}>
        <p><strong>{imported.sources.length} sources ready to review</strong>{imported.productCount ? ` · ${imported.productCount} products found` : ''}</p>
        <p className="ai-small">Read on {new Date(imported.importedAt).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' })}. This is a snapshot. Use Read my website again when your website changes.</p>
        {imported.warnings.length > 0 && <ul className="ai-small">{imported.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        <details><summary>Pages used</summary><ul>{imported.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>{source.truncated && <strong> · Partially imported ({source.characters?.toLocaleString()} / {source.originalCharacters?.toLocaleString()} characters)</strong>}</li>)}</ul></details>
        {knowledge !== imported.knowledge && <details><summary>Review the new import</summary><pre className="ai-pre" style={{ maxHeight: 320, overflow: 'auto' }}>{imported.knowledge}</pre><button type="button" className="ai-button ai-secondary" onClick={() => { setKnowledge(imported.knowledge); setNotice('Imported information is now in your draft. Save the draft, then publish when ready.'); }}>Replace draft with this import</button><p className="ai-small">Replaces the information below. Your published answers stay unchanged until you save and publish.</p></details>}
      </div>}
    </>}
    <div hidden={mode === 'website' && !knowledge.trim()} style={{ marginTop: 20 }}>
      {mode === 'website' ? <details open={Boolean(imported)}><summary>Review or correct imported information</summary><label className="ai-field">Information your assistant can use<textarea rows={12} name="businessKnowledge" maxLength={MAX_BUSINESS_KNOWLEDGE} value={knowledge} onChange={event => setKnowledge(event.target.value)} /></label></details> : <>
        <p className="ai-small">Tell us about your products or services, prices, opening hours, FAQs and policies. Include only information your assistant may share with customers.</p>
        <label className="ai-field">Business information and FAQs<textarea rows={12} name="businessKnowledge" maxLength={MAX_BUSINESS_KNOWLEDGE} value={knowledge} onChange={event => setKnowledge(event.target.value)} placeholder="What do you offer? What do customers usually ask? What should they know before ordering or booking?" /></label>
      </>}
      <p className="ai-small">{knowledge.length.toLocaleString()} / {MAX_BUSINESS_KNOWLEDGE.toLocaleString()} characters. Save the draft, test it, then select Publish saved information.</p>
    </div>
    <p className="ai-small">Draft changes do not replace published answers until you select Publish saved information.</p>
  </fieldset>;
}
