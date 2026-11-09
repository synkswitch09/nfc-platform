import { beforeEach, expect, it, vi } from 'vitest';
import type { AssistantWorkspace } from '@prisma/client';
const mocks = vi.hoisted(() => ({ reply: vi.fn(), upsert: vi.fn(), claim: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { assistantUsage: { upsert: mocks.upsert, updateMany: mocks.claim, update: mocks.update } } }));
vi.mock('@/lib/assistants/providers', () => ({ getAssistantProvider: () => ({ reply: mocks.reply }) }));
import { assistantReply } from '@/lib/assistants/replies';
const workspace = { id: 'workspace', name: 'Kosykin', modelKey: 'claude-sonnet', allowedModelKeys: ['claude-sonnet'], billingExempt: true, pausedAt: null, knowledgeApprovedAt: new Date(), masterPrompt: 'DRAFT VOICE', publishedPrompt: 'PUBLISHED VOICE', businessKnowledge: 'DRAFT ONLY: Pickup on Mars.', publishedKnowledge: 'Local pickup in Parafield Gardens. Select pickup at checkout.' } as unknown as AssistantWorkspace;
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ANTHROPIC_API_KEY', 'unit-test'); mocks.upsert.mockResolvedValue({ id: 'usage' }); mocks.claim.mockResolvedValue({ count: 1 }); mocks.reply.mockResolvedValue({ text: 'Answer', inputTokens: 10, outputTokens: 2 }); });
it('uses only published knowledge for real channels, with honest browsing and link rules', async () => {
  await assistantReply(workspace, [{ role: 'user', content: 'Puedo recogerlo?' }], false, 'social-message');
  const request = mocks.reply.mock.calls[0][1];
  expect(request.system).toContain('Parafield Gardens'); expect(request.system).not.toContain('Mars'); expect(request.system).toContain('PUBLISHED VOICE');
  expect(request.system).toContain('Do not automatically include a website URL'); expect(request.system).toContain('no browsing tools are connected'); expect(request.research).toBeUndefined();
});
it('private tests use the saved draft and do not alter published knowledge', async () => {
  await assistantReply(workspace, [{ role: 'user', content: 'Pickup?' }], true);
  const request = mocks.reply.mock.calls[0][1]; expect(request.system).toContain('Mars'); expect(request.system).not.toContain('Parafield Gardens'); expect(request.system).toContain('DRAFT VOICE');
});
