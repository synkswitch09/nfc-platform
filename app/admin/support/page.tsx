import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPageContext,hasPermission } from "@/lib/admin";
import { AdminSupportAction } from "@/components/admin-support-action";
export default async function AdminSupportPage() {
  const context=await requireAdminPageContext();const {store}=context;
  const requests = await db.orderSupportRequest.findMany({ where: { storeId: store.id }, include: { order: { select: { orderNumber: true, customerName: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Support · {store.displayName}</p><h1>Order requests</h1><p>Review changes, cancellation requests and exceptions here. Customers cannot cancel an order directly.</p></div></div><div className="admin-stack">{requests.map(item => <section key={item.id} className="admin-panel"><p><strong>{item.kind.replaceAll("_", " ")}</strong> · {item.status.replaceAll("_", " ")} · <Link href={`/admin/orders/${item.orderId}`}>{item.order.orderNumber}</Link> · {item.order.customerName}</p><p>{item.message}</p>{Array.isArray(item.attachments)&&item.attachments.map((_,i)=><a key={i} href={`/api/account/support/${item.id}/photos/${i}`} target="_blank" rel="noreferrer">Photo {i+1} </a>)}{hasPermission(context,"support.write")&&<AdminSupportAction requestId={item.id} status={item.status} adminNote={item.adminNote} />}</section>)}</div>{!requests.length && <div className="admin-empty">No support requests yet.</div>}</div>;
}
