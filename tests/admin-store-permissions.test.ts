import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({user:vi.fn(),store:vi.fn(),member:vi.fn(),headers:vi.fn()}));
vi.mock("next/headers",()=>({headers:m.headers}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
vi.mock("@/lib/auth",()=>({getCurrentUser:m.user}));
vi.mock("@/lib/db",()=>({db:{storeMembership:{findUnique:m.member}}}));
vi.mock("@/lib/storefront",()=>({getCurrentStorefront:m.store,deploymentEnvironment:vi.fn()}));
vi.mock("@/lib/config",()=>({currentAppEnvironment:vi.fn()}));
import {getAdminApiContext} from "@/lib/admin";
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({id:"u",role:"STAFF"});m.store.mockResolvedValue({id:"store-a"});m.member.mockResolvedValue({role:"STAFF",operationsEnabled:true,operationsRoles:["CATALOG"],permissions:[]});m.headers.mockResolvedValue(new Headers({"x-admin-path":"/api/admin/products/123","x-admin-method":"PATCH"}));});
describe("Administrative authorization at the server boundary",()=>{
 it("allows catalog edits only with current-store membership",async()=>{expect(await getAdminApiContext()).not.toBeNull();expect(m.member.mock.calls[0][0].where.storeId_userId).toEqual({storeId:"store-a",userId:"u"});m.member.mockResolvedValue(null);expect(await getAdminApiContext()).toBeNull();});
 it("rejects a role opening an unrelated endpoint",async()=>{m.headers.mockResolvedValue(new Headers({"x-admin-path":"/api/admin/team/invitations","x-admin-method":"POST"}));expect(await getAdminApiContext()).toBeNull();});
 it("rejects writes for readonly users and suspended memberships",async()=>{m.member.mockResolvedValue({role:"STAFF",operationsEnabled:true,operationsRoles:["READ_ONLY"],permissions:["catalog.write"]});expect(await getAdminApiContext()).toBeNull();m.member.mockResolvedValue({role:"STAFF",operationsEnabled:false,operationsRoles:["CATALOG"],permissions:[]});expect(await getAdminApiContext()).toBeNull();});
 it("preserves the principal administrator even without store membership",async()=>{m.user.mockResolvedValue({id:"principal",role:"ADMIN"});m.member.mockResolvedValue(null);expect(await getAdminApiContext()).toMatchObject({isPlatformAdmin:true});});
});
