import { AdminProductForm, type AdminProductInitial } from "@/components/admin-product-form";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";
import { KEYCHAIN_COLOURS, KEYCHAIN_FONTS, KEYRING_HARDWARE } from "@/lib/keychain";

const setupLabels: Record<string, string> = {
  nfc: "NFC product",
  standard: "Single version product",
  colour: "Product with one colour",
  "two-colour": "Product with multiple colours",
  keychain: "Custom 3D name keychain",
  variants: "Product with sizes, styles or other variants",
};

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{template?:string}> }) {
  const { store } = await requireAdminPageContext();
  const requested = (await searchParams).template ?? "";
  const allowed = store.slug === "kosykin" ? ["standard", "colour", "two-colour", "keychain", "variants"] : ["nfc", "standard", "colour", "two-colour", "variants"];
  const template = allowed.includes(requested) ? requested : "";
  const initial: AdminProductInitial = { name: "", slug: "", description: "", fullDescription: "", categoryId: "", type: "ACCESSORY", status: "DRAFT", featured: false, shopVisible: false, brand: store.displayName, gstInclusive: true, personalisationMode: "NONE", weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, defaultPackagingId: "", shipsSeparately: false, shippingPackageType: "BOX", specialHandling: "", countryOfOrigin: "", customsDescription: "", hsCode: "", customsValue: "", dutiesHandling: "UNDETERMINED", restrictedItem: false, seoTitle: "", seoDescription: "", ogImageUrl: "", canonicalUrl: "", indexable: false, variants: [], options: [] };
  const [categories, packaging] = await Promise.all([
    db.productCategory.findMany({ where: { storeId: store.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.packaging.findMany({ where: { storeId: store.id, active: true }, select: { id: true, name: true, code: true, lengthMm: true, widthMm: true, heightMm: true }, orderBy: { name: "asc" } }),
  ]);
  if (template === "colour" || template === "two-colour") {
    const colourOption = (name: string, code: string) => ({ name, code, type: "COLOUR" as const, required: true, maxLength: null, price: "0", helpText: "Add the colours available for this product and upload photos for each colour.", values: [] });
    initial.options = template === "colour" ? [colourOption("Colour", "colour")] : [colourOption("Background", "base-colour"), colourOption("Letters / accent", "accent-colour")];
  }
  if (template === "nfc") initial.type = "PET";
  if (template === "keychain") {
    const value=(label:string,value:string,swatchHex="")=>({label,value,price:"0",active:true,swatchHex,swatchHexSecondary:"",swatchImageUrl:""});
    initial.name="Personalised 3D name keychain";initial.slug="custom-name-keychain";initial.description="A made-to-order two-colour 3D name keychain with raised or flush lettering and a live preview.";
    initial.fullDescription="Choose a name, a typeface, a size and two colours. Choose a backing that follows the name or a rounded rectangle, then finish as a plain tag or a keyring. Made to order in Adelaide.";
    initial.type="CUSTOM";initial.personalisationMode="REQUIRED";initial.weightGrams=25;initial.lengthMm=130;initial.widthMm=30;initial.heightMm=4;
    initial.categoryId=categories.find(c=>/3d|print|keychain/i.test(c.name))?.id??categories[0]?.id??"";
    initial.shippingPackageType="MAILER";
    initial.variants=[{sku:"KOS-NAME-3D",name:"Made to order",colour:"",size:"",material:"PLA",productionMinutes:45,price:"0",inventory:0,trackInventory:false,lowStockThreshold:0,backorderPolicy:"DENY",active:true,isDefault:true,optionSelection:""}];
    initial.options=[
      {name:"Name",code:"keychain-name",type:"SHORT_TEXT",required:true,maxLength:24,price:"0",helpText:"The shape and length adjust to your name.",values:[]},
      {name:"Font",code:"keychain-font",type:"SELECT",required:true,maxLength:null,price:"0",helpText:"Choose a printable typeface.",values:Object.entries(KEYCHAIN_FONTS).map(([key,label])=>value(label,key))},
      {name:"Size",code:"keychain-size",type:"SELECT",required:true,maxLength:null,price:"0",helpText:"Regular 10 mm, Medium 15 mm, Large 20 mm letters. Long names shrink to fit.",values:[value("Regular","regular"),value("Medium","medium"),value("Large","large")]},
      {name:"Base colour",code:"base-colour",type:"COLOUR",required:true,maxLength:null,price:"0",helpText:"Colour of the background and keyring loop.",values:Object.entries(KEYCHAIN_COLOURS).sort(([a],[b])=>a==="peach"?-1:b==="peach"?1:0).map(([key,hex])=>value(key[0].toUpperCase()+key.slice(1),key,hex))},
      {name:"Letter colour",code:"letter-colour",type:"COLOUR",required:true,maxLength:null,price:"0",helpText:"Choose a different colour from the base.",values:Object.entries(KEYCHAIN_COLOURS).map(([key,hex])=>value(key[0].toUpperCase()+key.slice(1),key,hex))},
      {name:"Letter finish",code:"letter-finish",type:"RADIO",required:true,maxLength:null,price:"0",helpText:"Raised: 2.6 mm base and 1.4 mm letters (4 mm total). Flush: letters sit inside a 2.6 mm tag.",values:[value("Raised letters","raised"),value("Flush letters","inlaid")]},
      {name:"Backing shape",code:"base-shape",type:"RADIO",required:true,maxLength:null,price:"0",helpText:"Choose a backing that follows the letters or a rounded rectangle.",values:[value("Follows the name","contour"),value("Rounded rectangle","rectangle")]},
      {name:"Finish",code:"keychain-attachment",type:"RADIO",required:true,maxLength:null,price:"0",helpText:"Choose a keyring loop or a plain tag without a loop.",values:[value("Keyring loop","keychain"),value("Plain tag","tag")]},
      {name:"Keyring hardware",code:"keyring-hardware",type:"SELECT",required:true,maxLength:null,price:"0",helpText:"Choose hardware only when the keyring loop is selected.",values:[...Object.entries(KEYRING_HARDWARE).map(([key,label])=>value(label,key)),value("No hardware (tag)","none")]},
    ];
  }
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>New product</h1><p>Choose a product setup first. The form will show the fields relevant to it.</p></div></div><form method="get" className="admin-panel product-setup-select"><label className="field">Type of product<select name="template" defaultValue={template} required><option value="" disabled>Select a product type</option>{allowed.map(key => <option key={key} value={key}>{setupLabels[key]}</option>)}</select></label><button className="button secondary">Continue</button></form>{template && <AdminProductForm key={template} initial={initial} categories={categories} packaging={packaging} storeSlug={store.slug} setupKind={template} />}</div>;
}
