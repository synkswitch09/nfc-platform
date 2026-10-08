import Link from "next/link";
import {requireUser} from "@/lib/auth";
import {db} from "@/lib/db";
import {getCurrentStorefront} from "@/lib/storefront";
import {parseAccountConfig} from "@/lib/account-config";
import {FavouriteButton} from "@/components/favourite-button";
import {notFound} from "next/navigation";
export default async function FavouritesPage(){const [user,store]=await Promise.all([requireUser(),getCurrentStorefront()]);if(!parseAccountConfig(store.accountConfig).favouritesEnabled)notFound();const data=await db.customerAccountData.findUnique({where:{storeId_userId:{storeId:store.id,userId:user.id}}});const products=await db.product.findMany({where:{storeId:store.id,status:"ACTIVE",slug:{in:data?.favourites??[]}}});return <section className="dashboard"><h1>My favourites</h1><div className="address-grid">{products.map(product=><article className="card" key={product.id}><h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2><FavouriteButton slug={product.slug}/></article>)}</div>{!products.length&&<p>Save products you like while browsing the shop.</p>}</section>;}
