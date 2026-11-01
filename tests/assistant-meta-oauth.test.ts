import { beforeEach,afterEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({find:vi.fn(),first:vi.fn(),claim:vi.fn(),save:vi.fn(),exchange:vi.fn(),cookie:vi.fn(),workspace:vi.fn(),actor:vi.fn(),session:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:mocks.cookie})}));
vi.mock('@/lib/db',()=>({db:{assistantMetaFlow:{findUnique:mocks.find,findFirst:mocks.first,updateMany:mocks.claim,update:mocks.save}}}));
vi.mock('@/lib/assistants/meta/graph',async original=>({...await original<typeof import('@/lib/assistants/meta/graph')>(),exchangeMetaCode:mocks.exchange}));
import { finishWhatsAppAuthorization } from '@/lib/assistants/meta/whatsapp';
import { finishMetaAuthorization } from '@/lib/assistants/meta/connections';
import { sha256 } from '@/lib/crypto';
const flow={id:'flow-id',workspaceId:'workspace-id',userId:'owner',sessionHash:sha256('session'),phase:'AUTHORIZING',expiresAt:new Date(Date.now()+60000),provider:'INSTAGRAM',withComments:false};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AI_ASSISTANTS_META_ENABLED','true');vi.stubEnv('AI_ASSISTANTS_META_APP_ID','123');vi.stubEnv('AI_ASSISTANTS_META_APP_SECRET','test-secret-long-enough');vi.stubEnv('AI_ASSISTANTS_META_VERIFY_TOKEN','test-verify-token-at-least-32-characters');vi.stubEnv('AI_ASSISTANTS_META_TOKEN_KEY','test-encryption-key-at-least-32-characters');mocks.cookie.mockReturnValue({value:'session'});mocks.find.mockResolvedValue({...flow});mocks.claim.mockResolvedValue({count:1});mocks.save.mockResolvedValue({});mocks.exchange.mockResolvedValue([{accountId:'123',pageId:'123',name:'Brand',token:'sensitive-token',authorizingUserId:'456',scopes:[]}]);});
afterEach(()=>vi.unstubAllEnvs());
it('consumes the session-bound state before exchanging the authorisation code and encrypts candidate tokens',async()=>{await finishMetaAuthorization('opaque-state','code','owner');expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.exchange.mock.invocationCallOrder[0]);expect(mocks.save.mock.calls[0][0].data.candidatesCiphertext).not.toContain('sensitive-token');expect(mocks.save.mock.calls[0][0].data.phase).toBe('SELECTING');});
it('does not exchange codes from another user',async()=>{await expect(finishMetaAuthorization('state','code','another-user')).rejects.toThrow('another sign-in');expect(mocks.exchange).not.toHaveBeenCalled();});
it('does not exchange codes after logout or with another session',async()=>{mocks.cookie.mockReturnValue({value:'different-session'});await expect(finishMetaAuthorization('state','code','owner')).rejects.toThrow('another sign-in');expect(mocks.exchange).not.toHaveBeenCalled();});
it('rejects expired authorisation before contacting Meta',async()=>{mocks.find.mockResolvedValue({...flow,expiresAt:new Date(0)});await expect(finishMetaAuthorization('state','code','owner')).rejects.toThrow('expired');expect(mocks.exchange).not.toHaveBeenCalled();});
it('allows only one of two racing callbacks to exchange the code',async()=>{mocks.claim.mockResolvedValueOnce({count:1}).mockResolvedValueOnce({count:0});const result=await Promise.allSettled([finishMetaAuthorization('state','code','owner'),finishMetaAuthorization('state','code','owner')]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(mocks.exchange).toHaveBeenCalledTimes(1);});
it('rejects a replay after the state has advanced',async()=>{mocks.find.mockResolvedValue({...flow,phase:'SELECTING'});await expect(finishMetaAuthorization('state','code','owner')).rejects.toThrow();expect(mocks.exchange).not.toHaveBeenCalled();});

it('rejects a WhatsApp code whose state, session, user or business does not match',async()=>{
 vi.stubEnv('AI_ASSISTANTS_WHATSAPP_ENABLED','true');vi.stubEnv('AI_ASSISTANTS_WHATSAPP_CONFIG_ID','789');mocks.first.mockResolvedValue(null);const request=vi.fn();vi.stubGlobal('fetch',request);
 await expect(finishWhatsAppAuthorization('workspace-id','owner','flow-id','wrong-state','code')).rejects.toThrow('another sign-in');
 expect(mocks.first.mock.calls[0][0].where).toMatchObject({workspaceId:'workspace-id',userId:'owner',provider:'WHATSAPP',stateHash:sha256('wrong-state'),sessionHash:sha256('session'),phase:'AUTHORIZING'});expect(request).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
it('does not exchange a WhatsApp code after another callback consumed its state',async()=>{
 vi.stubEnv('AI_ASSISTANTS_WHATSAPP_ENABLED','true');vi.stubEnv('AI_ASSISTANTS_WHATSAPP_CONFIG_ID','789');mocks.first.mockResolvedValue({...flow,provider:'WHATSAPP'});mocks.claim.mockResolvedValue({count:0});const request=vi.fn();vi.stubGlobal('fetch',request);
 await expect(finishWhatsAppAuthorization('workspace-id','owner','flow-id','state','code')).rejects.toThrow('already been used');expect(request).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
