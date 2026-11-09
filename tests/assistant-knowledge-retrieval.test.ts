import { describe, expect, it } from 'vitest';
import { knowledgeAudit, knowledgeSources, MAX_REPLY_KNOWLEDGE, selectKnowledge } from '@/lib/assistants/knowledge';
const source = (title: string, path: string, text: string) => `\n--- ${title} ---\nSource: https://kosykin.com.au/${path}\n${text}\n`;
const snapshot = 'Website source: https://kosykin.com.au/\nImported: 2026-11-09T01:00:00Z\nThis is an imported snapshot, not live browsing.\n' + source('Kosykin', '', 'Colourful accessories made in Adelaide.') + source('Shipping', 'shipping', 'Shipping within Australia. Delivery options and postage prices appear at checkout.') + source('FAQs', 'faq', 'Can I pick up my order?\nYes! Select Local pickup at checkout to collect from Parafield Gardens. We email collection instructions.') + source('Wavy Multi Stand', 'products/wavy-multi-stand', 'Wavy Multi Stand\nAUD $24.95\nA curved phone and tablet stand.\nColours: pink and blue.') + source('Mini Tray', 'products/mini-tray', 'Mini Tray\nAUD $15.00\nStore small items.');
const select = (question: string) => selectKnowledge(snapshot, [{ role: 'user', content: question }]);
describe('relevant business knowledge selection', () => {
  it('retrieves English pickup facts for a Spanish question and keeps the actual source URL', () => {
    const result = select('Y puedo recogerlo en persona?');
    expect(result.text).toContain('Parafield Gardens'); expect(result.sources.some(s => s.url?.endsWith('/faq'))).toBe(true);
    expect(result.sources[0].title).toBe('FAQs');
  });
  it('retrieves product pricing and options by name without defaulting to the homepage', () => {
    const result = select('Quiero saber mas acerca del wavy multistand');
    expect(result.text).toContain('AUD $24.95'); expect(result.sources[0].url).toContain('/products/wavy-multi-stand');
  });
  it('offers available product summaries for a general catalogue question', () => {
    const result = select('Que productos venden?');
    expect(result.text).toContain('Wavy Multi Stand'); expect(result.text).toContain('Mini Tray'); expect(result.text).toContain('AUD $24.95');
    expect(result.sources.every(s => s.url?.includes('/products/'))).toBe(true);
  });
  it('uses previous customer context for a short follow-up rather than previous assistant guesses', () => {
    const result = selectKnowledge(snapshot, [{ role: 'user', content: 'Wavy Multi Stand' }, { role: 'assistant', content: 'The Mini Tray has orange colours. Unverified.' }, { role: 'user', content: 'Y en que colores?' }]);
    expect(result.sources[0].title).toBe('Wavy Multi Stand'); expect(result.text).toContain('pink and blue');
  });
  it('does not inject catalogue URLs or restart old product discussions for a greeting', () => {
    expect(selectKnowledge(snapshot, [{ role: 'user', content: 'Wavy Multi Stand' }, { role: 'user', content: 'Hola' }]).text).toBe('');
    expect(select('Thank you!').sources).toHaveLength(0);
  });
  it('finds pickup near the end of a large source without letting one policy fill the context', () => {
    const text = source('Terms', 'terms', 'Shipping delivery postage dispatch. '.repeat(5000)) + source('FAQs', 'faq', 'Other business information. '.repeat(2000) + '\nLocal pickup in Parafield Gardens.');
    const result = selectKnowledge(text, [{ role: 'user', content: 'Envio o recogida?' }]);
    expect(result.text).toContain('Parafield Gardens'); expect(result.text.length).toBeLessThanOrEqual(MAX_REPLY_KNOWLEDGE);
    expect(result.selectedCharacters).toBe(result.text.length);
  });
  it('preserves manual notes and exposes import coverage without feeding metadata to the model', () => {
    const text = snapshot.replace('This is an imported snapshot, not live browsing.', 'This is an imported snapshot, not live browsing.\nImport coverage: 5/5 sources; 0 truncated.\nBusiness note: pickup available Saturday.');
    expect(knowledgeSources(text)[0].text).toContain('pickup available Saturday');
    expect(knowledgeAudit(text).importNotes).toContain('5/5');
    expect(knowledgeAudit(text).sources.some(s => s.title === 'Wavy Multi Stand')).toBe(true);
    expect(selectKnowledge(text, [{ role: 'user', content: 'Saturday pickup?' }]).text).not.toContain('Import coverage:');
  });
});
