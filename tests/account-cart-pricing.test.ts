import {describe,it,expect} from "vitest";
import {savedCartRevision} from "@/lib/account-cart";
import {restoreAccountCartLine,repeatOrderConfiguration} from "@/lib/account-cart-pricing";
const options=[{code:"finish",type:"SELECT" as const,required:true,maxLength:null,priceDeltaCents:100,active:true,values:[{value:"raised",active:true,priceDeltaCents:400}]},{code:"name",type:"SHORT_TEXT" as const,required:true,maxLength:40,priceDeltaCents:300,active:true,values:[]}];
const variant={id:"00000000-0000-4000-8000-000000000001",name:"Made to order",priceCents:2400,optionSelection:{},product:{name:"Keychain",personalisationMode:"REQUIRED" as const,options}};
const line={variantId:variant.id,quantity:1,personalisationChoice:"PERSONALISED" as const,personalisation:{finish:"raised",name:"Daniel"}};
describe("Saved cart and repeat order pricing",()=>{
 it("restores the current price including selected extras and text personalisation",()=>{expect(restoreAccountCartLine(line,variant).unitPriceCents).toBe(3200);});
 it("does not charge variant-included options twice",()=>{expect(restoreAccountCartLine(line,{...variant,optionSelection:{finish:"raised"}}).unitPriceCents).toBe(2700);});
 it("retains historical selections but removes generated print metadata when repeating",()=>{const personalisation=repeatOrderConfiguration({name:"Daniel"},{finish:"raised","base-colour-hex":"#ffff00"},options);expect(personalisation).toEqual({name:"Daniel",finish:"raised"});expect(restoreAccountCartLine({...line,personalisation},variant).unitPriceCents).toBe(3200);});
 it("keeps cart conflict checks independent of favourite or profile updates",()=>{const old={cart:[line],favourites:[],updatedAt:"old"};const favouriteChange={...old,favourites:["keychain"],updatedAt:"new"};expect(savedCartRevision(old.cart)).toBe(savedCartRevision(favouriteChange.cart));expect(savedCartRevision([{...line,quantity:2}])).not.toBe(savedCartRevision(old.cart));expect(savedCartRevision([{...line,personalisation:{name:"Daniel",finish:"raised"}}])).toBe(savedCartRevision(old.cart));});
 it("refuses retired or mismatched configurations rather than displaying a base-only price",()=>{expect(()=>restoreAccountCartLine({...line,personalisation:{name:"Daniel",finish:"removed"}},variant)).toThrow();expect(()=>restoreAccountCartLine(line,{...variant,optionSelection:{finish:"different"}})).toThrow();});
});
