'use client';
import { useState } from 'react';
import { knowledgeAudit, selectKnowledge } from '@/lib/assistants/knowledge';
function Snapshot({ label, value }: { label: string; value: string }) {
  const audit = knowledgeAudit(value);
  return <details><summary>{label} · {audit.characters.toLocaleString()} characters · {audit.sources.length} source sections</summary>
    <p className="ai-small">{audit.importedAt ? `Imported: ${audit.importedAt}` : 'Manual information or an older snapshot without an import date.'}</p>
    {audit.importNotes && <p className="ai-small">{audit.importNotes}</p>}
    <ul className="ai-small">{audit.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
    {audit.legacyLimit && <p className="ai-status">This snapshot is near the old 30,000-character limit. It may be incomplete. Import again and review coverage before publishing.</p>}
    <ul className="ai-small">{audit.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title} · {s.characters.toLocaleString()} characters{s.truncated ? ` · Partially imported (${s.originalCharacters?.toLocaleString()} original characters)` : ""}</li>)}</ul>
    <details><summary>Read exact saved information</summary><pre className="ai-pre" style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{value || 'No information saved.'}</pre></details>
  </details>;
}
export function AssistantKnowledgeAudit({ draft, published, publishedAt }: { draft: string; published: string; publishedAt: Date | string | null }) {
  const [question, setQuestion] = useState(''), [version, setVersion] = useState('published'), [query, setQuery] = useState('');
  const selection = query ? selectKnowledge(version === 'published' ? published : draft, [{ role: 'user', content: query }]) : null;
  return <section className="ai-card" aria-label="Knowledge coverage">
    <h3>What your assistant knows</h3>
    <p className="ai-small">Customer replies use the published snapshot, not the live website. Imports and saved drafts do not update it until you publish.</p>
    <p><strong>{publishedAt ? `Published on ${new Date(publishedAt).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' })}` : 'No information published yet'}</strong>{publishedAt && draft !== published ? ' · Saved draft differs from published information' : ''}</p>
    <Snapshot label="Published information used for customer replies" value={published}/>
    <Snapshot label="Saved draft used for private answer tests" value={draft}/>
    <details><summary>Check the context for a customer question · no AI credits</summary>
      <label className="ai-field">Version<select value={version} onChange={e => { setVersion(e.target.value); setQuery(''); }}><option value="published">Published — customer replies</option><option value="draft">Saved draft — private tests</option></select></label>
      <label className="ai-field">Customer question<input value={question} maxLength={3000} onChange={e => setQuestion(e.target.value)} placeholder="Can I collect my order?"/></label>
      <button type="button" className="ai-button ai-secondary" disabled={!question.trim()} onClick={() => setQuery(question.trim())}>Inspect relevant information</button>
      {selection && <div role="status"><p className="ai-small">{selection.selectedCharacters.toLocaleString()} reference characters selected from {selection.availableSources} source sections. Uses the same selection rules as replies; conversation history can change the selection. No AI answer is generated.</p>
        <ul className="ai-small">{selection.sources.map((s, i) => <li key={i}>{s.title}{s.url ? ` — ${s.url}` : ''}</li>)}</ul>
        <pre className="ai-pre" style={{ maxHeight: 350, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{selection.text || 'No reference context selected. Greetings do not need catalogue information.'}</pre></div>}
    </details>
  </section>;
}
