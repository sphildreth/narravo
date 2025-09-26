// SPDX-License-Identifier: Apache-2.0
import { getPostForEdit } from "@/app/(admin)/admin/posts/actions";
import PostForm from "@/components/admin/posts/PostForm";
import { notFound } from "next/navigation";

interface EditPostPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const resolvedParams = await params;
  const post = await getPostForEdit(resolvedParams.id);
  
  if (!post) {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Post</h1>
        <p className="text-muted-foreground">Edit "{post.title}"</p>
      </div>

      <PostForm post={post} />
    </main>
  );
}