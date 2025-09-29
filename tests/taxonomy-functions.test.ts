// SPDX-License-Identifier: Apache-2.0
/**
 * Simple tests for taxonomy functions
 */

import { describe, it, expect } from 'vitest';

describe('Taxonomy Functions', () => {
  it('should have expected export structure', async () => {
    // These are basic structural tests that don't require database
    const taxonomy = await import('../src/lib/taxonomy');
    expect(typeof taxonomy).toBe('object');
  });

  it('should export expected functions', async () => {
    // Test that the module exports the expected functions
    const taxonomy = await import('../src/lib/taxonomy');
    
    expect(typeof taxonomy.upsertTag).toBe('function');
    expect(typeof taxonomy.upsertCategory).toBe('function');
    expect(typeof taxonomy.getPostTags).toBe('function');
    expect(typeof taxonomy.getPostCategory).toBe('function');
    expect(typeof taxonomy.getAllTags).toBe('function');
    expect(typeof taxonomy.getAllCategories).toBe('function');
    expect(typeof taxonomy.setPostTags).toBe('function');
    expect(typeof taxonomy.setPostCategory).toBe('function');
  });
});

// Test for PostForm component structure
describe('PostForm Component', () => {
  it.skip('should export PostForm as default (skipped due to next-auth module resolution)', async () => {
    const PostFormModule = await import('../src/components/admin/posts/PostForm');
    expect(typeof PostFormModule.default).toBe('function');
  });
});

// Test for post actions
describe('Post Actions', () => {
  it.skip('should export server actions (skipped due to next-auth module resolution)', async () => {
    const actions = await import('../src/app/(admin)/admin/posts/actions');
    
    expect(typeof actions.createPost).toBe('function');
    expect(typeof actions.updatePost).toBe('function');
    expect(typeof actions.getAllTagsAction).toBe('function');
    expect(typeof actions.getAllCategoriesAction).toBe('function');
    expect(typeof actions.getPostTagsAction).toBe('function');
    expect(typeof actions.getPostCategoryAction).toBe('function');
  });
});