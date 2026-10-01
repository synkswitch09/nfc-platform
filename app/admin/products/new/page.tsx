import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";
import { KEYCHAIN_COLOURS, KEYCHAIN_FONTS } from "@/lib/keychain";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{template?:string}> }) {
  const { store } = await requireAdminPageContext();
  const initial: AdminProductInitial = { name: "", slug: "", description: "", fullDescription: "", categoryId: "", type: "ACCESSORY", status: "DRAFT", featured: false, shopVisible: false, brand: store.displayName, gstInclusive: true, personalisationMode: "NONE", weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, defaultPackagingId: "", shipsSeparately: false, specialHandling: "", countryOfOrigin: "", customsDescription: "", hsCode: "", customsValue: "", dutiesHandling: "UNDETERMINED", restrictedItem: false, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false, variants: [], options: [] };
  const [categories, packaging] = await Promise.all([
    db.productCategory.findMany({ where: { storeId: store.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.packaging.findMany({ where: { storeId: store.id, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (store.slug === "kosykin" && (await searchParams).template === "keychain") {
    const value=(label:string,value:string,swatchHex="")=>({label,value,price:"0",active:true,swatchHex,swatchHexSecondary:"",swatchImageUrl:""});
    initial.name="Personalised 3D name keychain";initial.slug="custom-name-keychain";initial.description="A made-to-order two-colour 3D name keychain with raised lettering and a live preview.";
    initial.fullDescription="Choose a name, a typeface, a size and two colours. The outline follows the name and includes a loop for a keyring. Made to order in Adelaide.";
    initial.type="CUSTOM";initial.personalisationMode="REQUIRED";initial.weightGrams=25;initial.lengthMm=130;initial.widthMm=30;initial.heightMm=5;
    initial.categoryId=categories.find(c=>/3d|print|keychain/i.test(c.name))?.id??categories[0]?.id??"";
    initial.variants=[{sku:"KOS-NAME-3D",name:"Made to order",colour:"",size:"",material:"PLA",price:"0",compareAtPrice:"",cost:"",inventory:0,trackInventory:true,lowStockThreshold:5,backorderPolicy:"DENY",active:true,isDefault:true,optionSelection:"",weightGrams:25,lengthMm:130,widthMm:30,heightMm:5,defaultPackagingId:""}];
    initial.options=[
      {name:"Name",code:"keychain-name",type:"SHORT_TEXT",required:true,maxLength:24,price:"0",helpText:"The shape and length adjust to your name.",values:[]},
      {name:"Font",code:"keychain-font",type:"SELECT",required:true,maxLength:null,price:"0",helpText:"Choose a printable typeface.",values:Object.entries(KEYCHAIN_FONTS).map(([key,label])=>value(label,key))},
      {name:"Size",code:"keychain-size",type:"SELECT",required:true,maxLength:null,price:"0",helpText:"Regular starts at 10 mm letters; Large at 20 mm.",values:[value("Regular","regular"),value("Large","large")]},
      {name:"Base colour",code:"base-colour",type:"COLOUR",required:true,maxLength:null,price:"0",helpText:"Colour of the background and keyring loop.",values:Object.entries(KEYCHAIN_COLOURS).sort(([a],[b])=>a==="peach"?-1:b==="peach"?1:0).map(([key,hex])=>value(key[0].toUpperCase()+key.slice(1),key,hex))},
      {name:"Letter colour",code:"letter-colour",type:"COLOUR",required:true,maxLength:null,price:"0",helpText:"Raised lettering; choose a different colour from the base.",values:Object.entries(KEYCHAIN_COLOURS).map(([key,hex])=>value(key[0].toUpperCase()+key.slice(1),key,hex))},
    ];
  }
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>New product</h1><p>Create it as a draft, then publish when pricing and stock are ready.</p></div></div><AdminProductForm initial={initial} categories={categories} packaging={packaging} /></div>;
}
