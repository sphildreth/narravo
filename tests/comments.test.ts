import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../lib/db", () => ({
  db: {
    select: vi.fn,
    insert: vi.fn,
  },
}));

const { __testables__, MAX_COMMENT_DEPTH } = await import("../lib/comments");

const { createCommentCore, CommentError, sanitizeMarkdown } = __testables__;

describe("createCommentCore", () => {
  const baseDeps = () => {
    return {
      ensurePostExists: vi.fn().mockResolvedValue(undefined),
      getParentComment: vi.fn(),
      countSiblings: vi.fn(),
      insertComment: vi.fn(),
      sanitizeBody: vi.fn(),
    };
  };

  it("creates root comments with materialized path", async () => {
    const deps = baseDeps();
    deps.countSiblings.mockResolvedValue(0);
    deps.insertComment.mockResolvedValue({ id: "c1" });
    deps.sanitizeBody.mockImplementation((value: string) => `<p>${value}</p>`);

    const result = await createCommentCore(deps as any, {
      postId: "post-1",
      parentId: null,
      bodyMd: "Hello world",
      userId: "user-1",
    });

    expect(deps.ensurePostExists).toHaveBeenCalledWith("post-1");
    expect(deps.countSiblings).toHaveBeenCalledWith("post-1", null);
    expect(deps.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "0001",
        depth: 0,
        bodyMd: "Hello world",
        bodyHtml: "<p>Hello world</p>",
      })
    );
    expect(result).toEqual({ id: "c1" });
  });

  it("creates child comments with incremented depth", async () => {
    const deps = baseDeps();
    deps.getParentComment.mockResolvedValue({
      id: "parent-1",
      postId: "post-1",
      depth: 1,
      path: "0001.0002",
    });
    deps.countSiblings.mockResolvedValue(2);
    deps.insertComment.mockResolvedValue({ id: "child-1" });
    deps.sanitizeBody.mockImplementation((value: string) => `<p>${value}</p>`);

    const result = await createCommentCore(deps as any, {
      postId: "post-1",
      parentId: "parent-1",
      bodyMd: "Nested reply",
      userId: "user-1",
    });

    expect(deps.countSiblings).toHaveBeenCalledWith("post-1", "parent-1");
    expect(deps.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "0001.0002.0003",
        depth: 2,
      })
    );
    expect(result).toEqual({ id: "child-1" });
  });

  it("throws when parent is missing", async () => {
    const deps = baseDeps();
    deps.getParentComment.mockResolvedValue(null);
    deps.countSiblings.mockResolvedValue(0);

    await expect(
      createCommentCore(deps as any, {
        postId: "post-1",
        parentId: "missing",
        bodyMd: "Test",
        userId: "user-1",
      })
    ).rejects.toBeInstanceOf(CommentError);
  });

  it("guards against depth overflow", async () => {
    const deps = baseDeps();
    deps.getParentComment.mockResolvedValue({
      id: "parent-1",
      postId: "post-1",
      depth: MAX_COMMENT_DEPTH - 1,
      path: "0001",
    });

    await expect(
      createCommentCore(deps as any, {
        postId: "post-1",
        parentId: "parent-1",
        bodyMd: "Too deep",
        userId: "user-1",
      })
    ).rejects.toBeInstanceOf(CommentError);
  });
});

describe("sanitizeMarkdown", () => {
  it("strips unsafe attributes", () => {
    const dirty = `<script>alert(1)</script><img src="x" onerror="alert(1)" />`;
    const clean = sanitizeMarkdown(dirty);
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("<script>");
  });
});
