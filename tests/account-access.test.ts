import {describe,it,expect} from "vitest";
import {effectivePermissions,permissionForRoute,hasPermission} from "@/lib/admin-permissions";
import {parseAccountConfig} from "@/lib/account-config";
import {mergeSavedCart,savedCartSchema} from "@/lib/account-cart";
import {validSupportPhoto} from "@/lib/support-attachments";
describe("Store team access",()=>{
 it("keeps critical permissions out of store administrator defaults",()=>{const granted=effectivePermissions(["STORE_ADMIN"]);expect(granted).toContain("orders.write");for(const permission of ["finance.refund","orders.cancel","orders.address","production.shared","customers.export"])expect(granted).not.toContain(permission);});
 it("does not expose customer orders or addresses to production",()=>{expect(effectivePermissions(["PRODUCTION"])).toEqual(["production.read","production.write"]);expect(permissionForRoute("/admin/orders/123")).toBe("orders.read");});
 it("makes read-only override any write permission",()=>{const granted=effectivePermissions(["READ_ONLY","STORE_ADMIN"],["finance.refund","orders.cancel"]);expect(granted.every(p=>p.endsWith(".read"))).toBe(true);});
 it("protects API writes, invitations, customer export and shipment labels",()=>{expect(permissionForRoute("/api/admin/products/123","PATCH")).toBe("catalog.write");expect(permissionForRoute("/api/admin/team/invitations","POST")).toBe("platform");expect(permissionForRoute("/api/admin/customers/export")).toBe("customers.export");expect(permissionForRoute("/api/admin/shipments/123/document")).toBe("shipping.read");expect(permissionForRoute("/api/admin/orders/123/keychain/456/model.3mf")).toBe("production.read");expect(permissionForRoute("/api/admin/pages/123","PATCH")).toBe("content.publish");expect(permissionForRoute("/api/admin/unknown","POST")).toBe("platform");});
 it("keeps support out of refunds and principal access intact",()=>{expect(hasPermission({isPlatformAdmin:false,permissions:effectivePermissions(["SUPPORT"])},"finance.refund")).toBe(false);expect(hasPermission({isPlatformAdmin:true},"finance.refund")).toBe(true);});
});
describe("Customer account safeguards",()=>{
 it("leaves Apple off until configured in CMS",()=>{expect(parseAccountConfig({}).appleEnabled).toBe(false);expect(parseAccountConfig({appleEnabled:true}).appleEnabled).toBe(true);});
 it("merges carts without multiplying quantities on repeat visits",()=>{const line={variantId:"00000000-0000-4000-8000-000000000001",quantity:2,personalisationChoice:"BASIC" as const,personalisation:{}};expect(mergeSavedCart([line],[line])).toEqual([line]);expect(mergeSavedCart([line],[{...line,quantity:3}])[0].quantity).toBe(3);expect(savedCartSchema.safeParse([{...line,quantity:999}]).success).toBe(false);});
 it("rejects masqueraded HTML photos",()=>{expect(validSupportPhoto({name:"photo.png",type:"image/png",data:Buffer.from("<html>private data</html>").toString("base64")})).toBe(false);expect(validSupportPhoto({name:"photo.png",type:"image/png",data:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]).toString("base64")})).toBe(true);});
});
