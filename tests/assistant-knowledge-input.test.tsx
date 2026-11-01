import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AssistantKnowledgeInput } from '@/components/assistants/knowledge-input';
const render = (knowledge: string) => renderToStaticMarkup(createElement(AssistantKnowledgeInput, { workspaceId: 'example', initialKnowledge: knowledge, disabled: false, onImportingChange: () => {} }));
it('offers website import first for an unconfigured business without requiring manual information', () => { const html = render(''); expect(html).toContain('Read my website'); expect(html).toMatch(/name="knowledgeSource"[^>]*checked/); expect(html).not.toContain('required=""'); });
it('opens manual entry for existing manual knowledge and keeps its saved contents', () => { const html = render('Pickup in Parafield Gardens.'); expect(html).toContain('Pickup in Parafield Gardens.'); expect(html).toContain('What do you offer?'); expect(html).not.toContain('Your website address'); });
it('recognizes a saved website snapshot and offers refresh without making the user re-enter the URL', () => { const html = render('Website source: https://kosykin.com.au/\nImported: 2026-11-01\nPublic FAQs'); expect(html).toContain('value="https://kosykin.com.au/"'); expect(html).toContain('Refresh website information'); expect(html).toContain('Public FAQs'); });
