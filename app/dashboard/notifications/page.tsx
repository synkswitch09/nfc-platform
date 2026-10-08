import Link from "next/link";
import {requireUser} from "@/lib/auth";
import {db} from "@/lib/db";
import {getCurrentStorefront} from "@/lib/storefront";
import {parseAccountConfig} from "@/lib/account-config";
import {notFound} from "next/navigation";
export default async function NotificationsPage(){const [user,store]=await Promise.all([requireUser(),getCurrentStorefront()]);if(!parseAccountConfig(store.accountConfig).notificationsEnabled)notFound();const updates=await db.orderStatusHistory.findMany({where:{order:{storeId:store.id,userId:user.id}},include:{order:{select:{id:true,orderNumber:true}}},orderBy:{createdAt:"desc"},take:100});return <section className="dashboard"><h1>Order updates</h1>{updates.map(update=><article className="card" key={update.id}><Link href={`/dashboard/orders/${update.order.id}`}><strong>{update.order.orderNumber}</strong></Link><p>{update.toStatus.replaceAll("_"," ")} · {update.createdAt.toLocaleString("en-AU")}</p></article>)}{!updates.length&&<p>Your order updates will appear here. Responses to requests are in the Help menu.</p>}</section>;}
