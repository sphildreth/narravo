"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  createPost, 
  updatePost, 
  generateSlugFromTitle, 
  checkSlugAvailability,
  getAllTagsAction,
  getAllCategoriesAction,
  getPostTagsAction,
  getPostCategoryAction
} from "@/app/(admin)/admin/posts/actions";
import TiptapEditor from "@/components/editor/TiptapEditor";
import logger from '@/lib/logger';
import type { TagDTO, CategoryDTO } from "@/types/content";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  html: string;
  bodyMd?: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string | null;
  categoryId?: string | null;
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
  
  // State for tags and categories
  const [availableTags, setAvailableTags] = useState<TagDTO[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryDTO[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagDTO[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDTO | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: post?.title || "",
    slug: post?.slug || "",
    excerpt: post?.excerpt || "",
    // Prefer Markdown when available; otherwise fall back to existing HTML so editor is populated for legacy posts
    bodyMd: ((post as any)?.bodyMd ?? (post as any)?.bodyHtml ?? (post as any)?.html) || "",
    publishedAt: post?.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : "",
    featuredImageUrl: post?.featuredImageUrl || "",
    featuredImageAlt: post?.featuredImageAlt || "",
  });

  // Load available tags and categories on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [tagsResult, categoriesResult] = await Promise.all([
          getAllTagsAction(),
          getAllCategoriesAction()
        ]);
        
        if (tagsResult.success) {
          setAvailableTags(tagsResult.tags);
        }
        if (categoriesResult.success) {
          setAvailableCategories(categoriesResult.categories);
        }
        
        // If editing existing post, load its tags and category
        if (post?.id) {
          const [postTagsResult, postCategoryResult] = await Promise.all([
            getPostTagsAction(post.id),
            post.categoryId ? getPostCategoryAction(post.categoryId) : Promise.resolve({ success: true, category: null })
          ]);
          
          if (postTagsResult.success) {
            setSelectedTags(postTagsResult.tags);
          }
          if (postCategoryResult.success && postCategoryResult.category) {
            setSelectedCategory(postCategoryResult.category);
          }
        }
      } catch (error) {
        logger.error("Error loading tags and categories:", error);
      }
    };
    
    loadData();
  }, [post?.id, post?.categoryId]);

  // Tag management functions
  const addTag = (tag: TagDTO) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagInput("");
    setShowTagDropdown(false);
  };

  const removeTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter(t => t.id !== tagId));
  };

  const createNewTag = async (name: string) => {
    try {
      // Simulate creating tag by adding to selected tags with temp ID
      const newTag: TagDTO = {
        id: `temp-${Date.now()}`,
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        createdAt: new Date().toISOString()
      };
      addTag(newTag);
    } catch (error) {
      logger.error("Error creating new tag:", error);
    }
  };

  const selectCategory = (category: CategoryDTO) => {
    setSelectedCategory(category);
    setCategoryInput("");
    setShowCategoryDropdown(false);
  };

  const createNewCategory = async (name: string) => {
    try {
      // Simulate creating category by setting as selected with temp ID
      const newCategory: CategoryDTO = {
        id: `temp-${Date.now()}`,
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        createdAt: new Date().toISOString()
      };
      setSelectedCategory(newCategory);
      setCategoryInput("");
      setShowCategoryDropdown(false);
    } catch (error) {
      logger.error("Error creating new category:", error);
    }
  };

  // Filter functions for dropdowns
  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) &&
    !selectedTags.find(selected => selected.id === tag.id)
  );

  const filteredCategories = availableCategories.filter(category =>
    category.name.toLowerCase().includes(categoryInput.toLowerCase())
  );

  // Local (deferred) featured image file state
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);

  // Revoke object URL when file changes/removed
  useEffect(() => {
    if (!featuredImageFile) {
      if (featuredImagePreview) {
        URL.revokeObjectURL(featuredImagePreview);
      }
      setFeaturedImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(featuredImageFile);
    setFeaturedImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [featuredImageFile]);

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
      logger.error("Error generating slug:", error);
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
        logger.error("Error checking slug availability:", error);
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
        
        // Add tags and category data
        submitData.append("tags", JSON.stringify(selectedTags.map(tag => tag.name)));
        if (selectedCategory) {
          submitData.append("category", selectedCategory.name);
        }
        
        // Featured image handling (deferred upload): if a file is chosen we append it;
        // otherwise rely on URL value (could be empty string)
        if (featuredImageFile) {
          submitData.append("featuredImageFile", featuredImageFile);
          submitData.append("featuredImageUrl", ""); // ensure server derives from file
        } else {
          submitData.append("featuredImageUrl", formData.featuredImageUrl);
        }
        submitData.append("featuredImageAlt", formData.featuredImageAlt);
        
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
        logger.error("Error saving post:", error);
        setErrors({ general: "An unexpected error occurred" });
      }
    });
  };

  // Stable editor change handler to avoid recreating function each render which
  // caused TiptapEditor effect (that depends on onChange) to run indefinitely.
  // Also guard against unnecessary state updates when markdown is unchanged.
  const handleEditorChange = useCallback((md: string) => {
    setFormData(prev => prev.bodyMd === md ? prev : { ...prev, bodyMd: md });
    // Clear bodyMd error when user types in editor
    setErrors(prev => prev.bodyMd ? { ...prev, bodyMd: "" } : prev);
  }, []);

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
            onChange={(e) => {
              setFormData(prev => ({ ...prev, title: e.target.value }));
              // Clear title error when user types
              if (errors.title) {
                setErrors(prev => ({ ...prev, title: "" }));
              }
            }}
            onBlur={async () => {
              // Auto-generate slug only for new posts (no existing post ID)
              if (!post && formData.title.trim() && !formData.slug.trim()) {
                await handleGenerateSlug();
              }
            }}
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
            onChange={(e) => {
              // Sanitize input proactively: allow only lowercase a-z, 0-9, hyphen; collapse consecutive hyphens; trim leading/trailing hyphens
              const raw = e.target.value.toLowerCase();
              const filtered = raw
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/-{2,}/g, '-')
                .replace(/^-+/, '')
                .replace(/-+$/, '');
              setFormData(prev => ({ ...prev, slug: filtered }));
              // Clear slug error when user types
              if (errors.slug) {
                setErrors(prev => ({ ...prev, slug: "" }));
              }
            }}
            onBlur={() => {
              // Final normalize (in case user pastes weird unicode)
              setFormData(prev => {
                const norm = prev.slug
                  .toLowerCase()
                  .normalize('NFKD')
                  .replace(/[^a-z0-9-]+/g, '-')
                  .replace(/-{2,}/g, '-')
                  .replace(/^-+/, '')
                  .replace(/-+$/, '');
                return prev.slug === norm ? prev : { ...prev, slug: norm };
              });
            }}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              errors.slug ? "border-red-300" : 
              slugAvailable === false ? "border-red-300" :
              slugAvailable === true ? "border-green-300" : "border-border"
            }`}
            placeholder="post-url-slug"
            // Removed pattern attribute to avoid browser RegExp compilation issues (observed /v flag error); custom validation already enforced.
            aria-describedby="slug-help"
            title="Lowercase letters, numbers, and hyphens only"
            disabled={isPending}
            inputMode="text" 
            autoComplete="off"
            spellCheck={false}
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
            <p id="slug-help" className="text-xs text-muted-foreground">
              {formData.slug ? (
                <>URL: /{formData.slug}</>
              ) : 'Allowed: lowercase letters, numbers, hyphens'}
            </p>
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
            onKeyDown={(e) => {
              // When Tab is pressed, focus the editor content area
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                // Focus the TiptapEditor content area using ProseMirror's class
                const editorContent = document.querySelector('.ProseMirror') as HTMLElement;
                if (editorContent) {
                  editorContent.focus();
                }
              }
            }}
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

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Tags
          </label>
          <div className="space-y-3">
            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                      disabled={isPending}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {/* Tag input with dropdown */}
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setShowTagDropdown(e.target.value.length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (tagInput.trim()) {
                      if (filteredTags.length > 0) {
                        addTag(filteredTags[0]!);
                      } else {
                        createNewTag(tagInput.trim());
                      }
                    }
                  }
                  if (e.key === 'Escape') {
                    setShowTagDropdown(false);
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                placeholder="Add tags..."
                disabled={isPending}
              />
              
              {/* Tag dropdown */}
              {showTagDropdown && (tagInput.length > 0) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredTags.length > 0 ? (
                    filteredTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                        disabled={isPending}
                      >
                        {tag.name}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => createNewTag(tagInput.trim())}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm text-blue-600"
                      disabled={isPending}
                    >
                      Create new tag: "{tagInput.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Type tag names and press Enter to add them
          </p>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Category
          </label>
          <div className="space-y-3">
            {/* Selected category */}
            {selectedCategory && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">
                {selectedCategory.name}
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="ml-1 text-green-600 hover:text-green-800"
                  disabled={isPending}
                >
                  ×
                </button>
              </div>
            )}
            
            {/* Category input with dropdown */}
            <div className="relative">
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => {
                  setCategoryInput(e.target.value);
                  setShowCategoryDropdown(e.target.value.length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (categoryInput.trim()) {
                      if (filteredCategories.length > 0) {
                        selectCategory(filteredCategories[0]!);
                      } else {
                        createNewCategory(categoryInput.trim());
                      }
                    }
                  }
                  if (e.key === 'Escape') {
                    setShowCategoryDropdown(false);
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                placeholder="Select or create category..."
                disabled={isPending}
              />
              
              {/* Category dropdown */}
              {showCategoryDropdown && (categoryInput.length > 0) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => selectCategory(category)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                        disabled={isPending}
                      >
                        {category.name}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => createNewCategory(categoryInput.trim())}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm text-green-600"
                      disabled={isPending}
                    >
                      Create new category: "{categoryInput.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Posts can only have one category
          </p>
        </div>

        {/* Featured Image (deferred upload) */}
        <div>
          <label className="block text-sm font-medium mb-2">Featured Image</label>
          <div className="space-y-3">
            {/* Preview: either existing URL (editing existing post) or local file preview */}
            {(featuredImagePreview || formData.featuredImageUrl) && (
              <div className="relative inline-block">
                <img
                  src={featuredImagePreview || formData.featuredImageUrl}
                  alt={formData.featuredImageAlt || "Featured image preview"}
                  className="max-w-sm h-32 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFeaturedImageFile(null);
                    setFormData(prev => ({ ...prev, featuredImageUrl: "", featuredImageAlt: "" }));
                  }}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-700 transition-colors"
                  disabled={isPending}
                >
                  ×
                </button>
              </div>
            )}

            {/* File input appears if no remote URL present or user is selecting a new one */}
            {!formData.featuredImageUrl && !featuredImagePreview && (
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFeaturedImageFile(file);
                      // Reset URL field to ensure server doesn't treat previous URL
                      setFormData(prev => ({ ...prev, featuredImageUrl: "" }));
                    }
                  }}
                  disabled={isPending}
                  className="text-sm"
                />
                <span className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, WebP, GIF.</span>
              </div>
            )}

            {/* URL input only shown when no file chosen and no preview */}
            {!featuredImagePreview && !featuredImageFile && (
              <div>
                <input
                  type="url"
                  value={formData.featuredImageUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, featuredImageUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  placeholder="Or enter image URL (https://...)"
                  disabled={isPending}
                />
              </div>
            )}

            {/* Alt text field displayed if either a file or URL is selected */}
            {(featuredImagePreview || formData.featuredImageUrl) && (
              <div>
                <input
                  type="text"
                  value={formData.featuredImageAlt}
                  onChange={(e) => setFormData(prev => ({ ...prev, featuredImageAlt: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  placeholder="Alternative text for accessibility"
                  maxLength={255}
                  disabled={isPending}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Content *
          </label>
          <div className="rounded-lg overflow-hidden">
            <TiptapEditor
              initialMarkdown={formData.bodyMd}
              onChange={handleEditorChange}
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