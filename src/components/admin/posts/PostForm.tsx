"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  createPost, 
  updatePost, 
  generateSlugFromTitle, 
  checkSlugAvailability 
} from "@/app/(admin)/admin/posts/actions";
import TiptapEditor from "@/components/editor/TiptapEditor";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  html: string;
  bodyMd?: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
}

interface PostFormProps {
  post?: Post;
}

export default function PostForm({ post }: PostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: post?.title || "",
    slug: post?.slug || "",
    excerpt: post?.excerpt || "",
    // Prefer Markdown when available; otherwise fall back to existing HTML so editor is populated for legacy posts
    bodyMd: ((post as any)?.bodyMd ?? (post as any)?.bodyHtml ?? (post as any)?.html) || "",
    publishedAt: post?.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : "",
  });

  // Validate slug format
  const isValidSlugFormat = (slug: string) => /^[a-z0-9-]+$/.test(slug);

  // Generate slug from title
  const handleGenerateSlug = async () => {
    if (!formData.title.trim()) return;

    setIsGeneratingSlug(true);
    try {
      const result = await generateSlugFromTitle(formData.title, post?.id);
      if (result.success && result.slug) {
        setFormData(prev => ({ ...prev, slug: result.slug! }));
        setSlugAvailable(true);
        setErrors(prev => ({ ...prev, slug: "" }));
      } else {
        setErrors(prev => ({ ...prev, slug: result.error || "Failed to generate slug" }));
      }
    } catch (error) {
      console.error("Error generating slug:", error);
      setErrors(prev => ({ ...prev, slug: "Failed to generate slug" }));
    } finally {
      setIsGeneratingSlug(false);
    }
  };

  // Check slug availability
  useEffect(() => {
    if (!formData.slug || !isValidSlugFormat(formData.slug)) {
      setSlugAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(formData.slug, post?.id);
        setSlugAvailable(result.available);
        if (!result.available && result.error) {
          setErrors(prev => ({ ...prev, slug: result.error! }));
        } else {
          setErrors(prev => ({ ...prev, slug: "" }));
        }
      } catch (error) {
        console.error("Error checking slug availability:", error);
        setSlugAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.slug, post?.id]);

  // Handle form submission
  const handleSubmit = async (action: "save" | "publish") => {
    setErrors({});
    
    // Client-side validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = "Slug is required";
    } else if (!isValidSlugFormat(formData.slug)) {
      newErrors.slug = "Slug must contain only lowercase letters, numbers, and hyphens";
    }
    
    if (!formData.bodyMd.trim()) {
      newErrors.bodyMd = "Content is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        const submitData = new FormData();
        submitData.append("title", formData.title);
        submitData.append("slug", formData.slug);
        submitData.append("excerpt", formData.excerpt);
        submitData.append("bodyMd", formData.bodyMd);
        
        // Handle publish action
        if (action === "publish") {
          submitData.append("publishedAt", new Date().toISOString());
        } else if (formData.publishedAt) {
          submitData.append("publishedAt", new Date(formData.publishedAt).toISOString());
        }

        let result;
        if (post) {
          // Update existing post
          submitData.append("id", post.id);
          submitData.append("updatedAt", post.updatedAt?.toISOString() || new Date().toISOString());
          result = await updatePost(submitData);
        } else {
          // Create new post
          result = await createPost(submitData);
        }

        if (result.success) {
          router.push("/admin/posts");
        } else {
          setErrors({ general: result.error || "Failed to save post" });
        }
      } catch (error) {
        console.error("Error saving post:", error);
        setErrors({ general: "An unexpected error occurred" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Error Messages */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {errors.general}
        </div>
      )}

      <form className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.title ? "border-red-300" : "border-border"
            }`}
            placeholder="Enter post title"
            disabled={isPending}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Slug */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="slug" className="block text-sm font-medium">
              Slug *
            </label>
            <button
              type="button"
              onClick={handleGenerateSlug}
              disabled={isPending || isGeneratingSlug || !formData.title.trim()}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isGeneratingSlug ? "Generating..." : "Generate from title"}
            </button>
          </div>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              errors.slug ? "border-red-300" : 
              slugAvailable === false ? "border-red-300" :
              slugAvailable === true ? "border-green-300" : "border-border"
            }`}
            placeholder="post-url-slug"
            pattern="[a-z0-9-]+"
            disabled={isPending}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.slug && (
              <p className="text-sm text-red-600">{errors.slug}</p>
            )}
            {!errors.slug && slugAvailable === false && (
              <p className="text-sm text-red-600">Slug is already taken</p>
            )}
            {!errors.slug && slugAvailable === true && (
              <p className="text-sm text-green-600">Slug is available</p>
            )}
            {formData.slug && (
              <p className="text-xs text-muted-foreground">
                URL: /{formData.slug}
              </p>
            )}
          </div>
        </div>

        {/* Excerpt */}
        <div>
          <label htmlFor="excerpt" className="block text-sm font-medium mb-2">
            Excerpt
          </label>
          <textarea
            id="excerpt"
            value={formData.excerpt}
            onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md"
            rows={3}
            maxLength={300}
            placeholder="Optional excerpt (up to 300 characters)"
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {formData.excerpt.length}/300 characters
          </p>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Content *
          </label>
          <div className="rounded-lg overflow-hidden">
            <TiptapEditor
              initialMarkdown={formData.bodyMd}
              onChange={(md) => setFormData(prev => ({ ...prev, bodyMd: md }))}
              placeholder="Write your post..."
            />
          </div>
          {errors.bodyMd && (
            <p className="mt-1 text-sm text-red-600">{errors.bodyMd}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Content is stored as Markdown and safely rendered to HTML.
          </p>
        </div>

        {/* Scheduled Publishing */}
        <div>
          <label htmlFor="publishedAt" className="block text-sm font-medium mb-2">
            Scheduled Publish Date
          </label>
          <input
            id="publishedAt"
            type="datetime-local"
            value={formData.publishedAt}
            onChange={(e) => setFormData(prev => ({ ...prev, publishedAt: e.target.value }))}
            className="px-3 py-2 border border-border rounded-md"
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Leave empty for draft. Future dates will not be published until the scheduled time.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-6 border-t border-border">
          <Link
            href="/admin/posts"
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/20"
          >
            Cancel
          </Link>
          
          <button
            type="button"
            onClick={() => handleSubmit("save")}
            disabled={isPending || slugAvailable === false}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Draft"}
          </button>
          
          <button
            type="button"
            onClick={() => handleSubmit("publish")}
            disabled={isPending || slugAvailable === false}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Publishing..." : post?.publishedAt ? "Update & Publish" : "Publish Now"}
          </button>

          {/* Preview (future enhancement) */}
          {formData.title && formData.bodyMd && (
            <Link
              href={`/${formData.slug}?preview=true`}
              target="_blank"
              className="ml-auto px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/20"
            >
              Preview
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}