import Link from "next/link";
import { db } from "@/lib/db";
export async function OrderReviewLinks({ orderId }: { orderId: string }) {
  const items = await db.orderItem.findMany({ where: { orderId }, select: { variant: { select: { product: { select: { id: true, slug: true, name: true } } } } } });
  const products = [...new Map(items.map(i => [i.variant.product.id, i.variant.product])).values()];
  return <section className="card"><h2>Review your purchases</h2>{products.map(product => <p key={product.id}><Link href={`/products/${product.slug}#reviews`}>Review {product.name}</Link></p>)}</section>;
}
