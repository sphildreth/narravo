// SPDX-License-Identifier: Apache-2.0
import PostForm from "@/components/admin/posts/PostForm";

export default function NewPostPage() {
  return (
    <main className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Post</h1>
        <p className="text-muted-foreground">Create a new blog post</p>
      </div>

      <PostForm />
    </main>
  );
}