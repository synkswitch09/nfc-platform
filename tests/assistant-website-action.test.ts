import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), update: vi.fn(), limit: vi.fn(), importer: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { assistantWorkspace: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock('@/lib/assistants/auth', () => ({ assistantUser: mocks.user }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.limit }));
vi.mock('@/lib/assistants/website-import', () => ({ importAssistantWebsite: mocks.importer }));
import { POST } from '@/app/api/assistants/workspaces/[id]/[action]/route';
const id = '916cad1a-07b8-4fa8-9315-7c1ef1fd88ae';
function call(body: unknown = { websiteUrl: 'https://kosykin.com.au' }, origin = 'https://admin.tapkin.com.au') {
 return POST(new NextRequest(`https://admin.tapkin.com.au/api/assistants/workspaces/${id}/import-website`, { method: 'POST', headers: { host: 'admin.tapkin.com.au', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id, action: 'import-website' }) });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('AI_ASSISTANTS_ORIGIN', 'https://admin.tapkin.com.au'); mocks.user.mockResolvedValue({ id: 'owner', role: 'USER', emailVerifiedAt: new Date() }); mocks.find.mockResolvedValue({ id, ownerId: 'owner' }); mocks.limit.mockResolvedValue({ allowed: true }); mocks.importer.mockResolvedValue({ knowledge: 'Imported FAQ', sources: [] }); });
it('returns the import for owner review without changing saved or published knowledge', async () => { const result = await call(); expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ knowledge: 'Imported FAQ' }); expect(mocks.update).not.toHaveBeenCalled(); });
it('denies another owner before importing a site', async () => { mocks.find.mockResolvedValue({ id, ownerId: 'other' }); expect((await call()).status).toBe(404); expect(mocks.importer).not.toHaveBeenCalled(); });
it('denies foreign origins before database access', async () => { expect((await call(undefined, 'https://evil.example')).status).toBe(403); expect(mocks.find).not.toHaveBeenCalled(); });
it('validates the URL field and rejects additional settings', async () => { expect((await call({ websiteUrl: '', billingExempt: true })).status).toBe(400); expect(mocks.importer).not.toHaveBeenCalled(); });
it('rate limits repeated imports without contacting the website', async () => { mocks.limit.mockResolvedValue({ allowed: false }); expect((await call()).status).toBe(429); expect(mocks.importer).not.toHaveBeenCalled(); });
