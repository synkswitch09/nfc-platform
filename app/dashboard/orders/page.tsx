import Link from "next/link";
import {Prisma,OrderStatus} from "@prisma/client";
import {requireUser} from "@/lib/auth";
import {db} from "@/lib/db";
import {getCurrentStorefront} from "@/lib/storefront";
import {claimVerifiedGuestOrders} from "@/lib/customer-account";
export default async function OrdersPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}){
 const [user,store,query]=await Promise.all([requireUser(),getCurrentStorefront(),searchParams]);await claimVerifiedGuestOrders(user,store.id);
 const q=(query.q??"").slice(0,80);const status=Object.values(OrderStatus).includes(query.status as OrderStatus)?query.status as OrderStatus:undefined;const page=Math.max(1,Math.min(1000,Number.parseInt(query.page??"1")||1));
 const where:Prisma.OrderWhereInput={storeId:store.id,userId:user.id,...(status?{status}:{}),...(q?{OR:[{orderNumber:{contains:q,mode:"insensitive"}},{items:{some:{productName:{contains:q,mode:"insensitive"}}}}]}:{})};
 const [orders,total]=await Promise.all([db.order.findMany({where,include:{items:{take:1},productionBooking:true},orderBy:{createdAt:"desc"},take:20,skip:(page-1)*20}),db.order.count({where})]);
 function pageHref(n:number){return `/dashboard/orders?${new URLSearchParams({q,status:status??"",page:String(n)})}`;}
 return <section className="dashboard"><h1>My orders</h1><form className="account-filters"><label className="field">Search<input name="q" defaultValue={q} placeholder="Order number or product" maxLength={80}/></label><label className="field">Status<select name="status" defaultValue={status??""}><option value="">All statuses</option>{Object.values(OrderStatus).map(s=><option key={s}>{s}</option>)}</select></label><button className="button secondary">Search</button></form><div className="tag-list">{orders.map(order=><Link className="tag-row" key={order.id} href={`/dashboard/orders/${order.id}`}><div><strong>{order.orderNumber}</strong><p>{order.items[0]?.productName} · {order.createdAt.toLocaleDateString("en-AU")}</p>{order.productionBooking&&!order.productionBooking.releasedAt&&<small>Estimated dispatch: {order.productionBooking.promisedAt.toLocaleDateString("en-AU")}</small>}</div><span className={`status ${order.status}`}>{order.status.replaceAll("_"," ")}</span><strong>{new Intl.NumberFormat("en-AU",{style:"currency",currency:order.currency}).format(order.totalCents/100)}</strong></Link>)}</div>{!orders.length&&<p>No orders match your search.</p>}<div className="actions">{page>1&&<Link href={pageHref(page-1)}>Previous</Link>}{page*20<total&&<Link href={pageHref(page+1)}>Next</Link>}</div></section>;
}
