import { notFound, permanentRedirect } from "next/navigation";
import { categoryPublicPath, getPublicCategory } from "@/lib/category-query";

export default async function LegacyCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = await getPublicCategory((await params).slug);
  if (!category) notFound();
  permanentRedirect(categoryPublicPath(category.slug));
}
