import { notFound } from "next/navigation";
export const dynamic = "force-static";
export const revalidate = 60;
export default async function PostPage({ params }: { params: { slug: string }}) {
  if (!params.slug) return notFound();
  return (
    <article className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold">{params.slug}</h1>
      <div className="prose mt-6">Post content goes here.</div>
    </article>
  );
}
