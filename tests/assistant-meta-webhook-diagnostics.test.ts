import { after,NextRequest } from "next/server";
import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";

const mocks=vi.hoisted(()=>({ready:true,signature:true,receive:vi.fn(),process:vi.fn(),callbacks:[] as Array<()=>Promise<void>>}));
vi.mock("next/server",async()=>{
 const actual=await vi.importActual<typeof import("next/server")>("next/server");
 return {...actual,after:vi.fn((callback:()=>Promise<void>)=>mocks.callbacks.push(callback))};
});
vi.mock("@/lib/assistants/meta/security",()=>({
 metaConfig:()=>({ready:mocks.ready}),validMetaSignature:()=>mocks.signature,secureEqual:()=>true,
}));
vi.mock("@/lib/assistants/meta/queue",()=>({receiveMetaEvents:mocks.receive,processMetaQueue:mocks.process}));
import { POST } from "@/app/api/assistants/meta/webhook/route";

describe("Meta webhook diagnostics",()=>{
 let logs:ReturnType<typeof vi.spyOn>;
 beforeEach(()=>{
  vi.clearAllMocks();mocks.ready=true;mocks.signature=true;mocks.callbacks=[];
  mocks.receive.mockReset().mockResolvedValue(0);mocks.process.mockReset().mockResolvedValue({processed:0});
  logs=vi.spyOn(console,"info").mockImplementation(()=>{});
 });
 afterEach(()=>vi.restoreAllMocks());
 function request(body:string){return new NextRequest("https://example.test/api/assistants/meta/webhook",{method:"POST",body,headers:{"x-hub-signature-256":"secret-signature"}});}
 function records(){return logs.mock.calls.map(call=>JSON.parse(String(call[1])));}
 it("records receipt and signature rejection without storing untrusted input",async()=>{
  mocks.signature=false;
  const response=await POST(request('{"object":"private-message"}'));
  expect(response.status).toBe(403);
  expect(mocks.receive).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
  expect(records().map(r=>r.event)).toEqual(["received","rejected"]);
  expect(records()[1]).toMatchObject({status:403,reason:"invalid_signature"});
  expect(records()[0].requestId).toBe(records()[1].requestId);
  expect(JSON.stringify(logs.mock.calls)).not.toContain("private-message");
  expect(JSON.stringify(logs.mock.calls)).not.toContain("secret-signature");
 });
 it("distinguishes accepted notifications with zero stored events and logs queue recovery failures safely",async()=>{
  const response=await POST(request(JSON.stringify({object:"page",entry:[],private:"customer text"})));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({received:true});
  expect(records()[1]).toMatchObject({event:"accepted",object:"page",stored:0,status:200});
  mocks.process.mockRejectedValueOnce(new Error("sensitive database URL"));
  await mocks.callbacks[0]();
  expect(records()[2]).toMatchObject({event:"queue_failed"});
  expect(records().every(r=>r.requestId===records()[0].requestId)).toBe(true);
  expect(JSON.stringify(logs.mock.calls)).not.toMatch(/customer text|sensitive database URL|secret-signature/);
 });
 it("reports stored counts and completed processing without logging arbitrary object labels",async()=>{
  mocks.receive.mockResolvedValueOnce(2);mocks.process.mockResolvedValueOnce({processed:2});
  await POST(request(JSON.stringify({object:"sensitive object",entry:[]})));
  await mocks.callbacks[0]();
  expect(records()[1]).toMatchObject({event:"accepted",stored:2,object:"other"});
  expect(records()[2]).toMatchObject({event:"queue_completed",processed:2});
  expect(JSON.stringify(logs.mock.calls)).not.toContain("sensitive object");
 });
 it("reports storage failure without exposing the exception or acknowledging success",async()=>{
  mocks.receive.mockRejectedValueOnce(new Error("password=private"));
  const response=await POST(request('{"object":"page","entry":[]}'));
  expect(response.status).toBe(500);
  expect(records()[1]).toMatchObject({event:"rejected",reason:"notification_storage_failed",status:500});
  expect(after).not.toHaveBeenCalled();
  expect(JSON.stringify(logs.mock.calls)).not.toContain("password");
 });
});
