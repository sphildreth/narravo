import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = { info: vi.fn(), error: vi.fn() };

const insertedUsers: any[][] = [];
const insertedPosts: any[][] = [];
const insertedComments: any[][] = [];

let uuidCounter = 0;

const connect = vi.fn(() => Promise.resolve());
const end = vi.fn(() => Promise.resolve());

class FakeClient {
  connectionString: string;
  constructor(opts: { connectionString: string }) {
    this.connectionString = opts.connectionString;
  }
  connect = connect;
  end = end;
}

const usersTable = { id: Symbol("users.id"), email: Symbol("users.email") } as any;
const postsTable = { id: Symbol("posts.id"), slug: Symbol("posts.slug"), publishedAt: Symbol("posts.publishedAt") } as any;
const commentsTable = {} as any;

const insert = vi.fn((table: any) => {
  const state: { values?: any } = {};
  const builder: any = {
    values(values: any) {
      state.values = values;
      if (table === commentsTable) {
        insertedComments.push(values);
        return Promise.resolve();
      }
      if (table === usersTable) {
        insertedUsers.push(values);
      }
      if (table === postsTable) {
        insertedPosts.push(values);
      }
      return builder;
    },
    onConflictDoUpdate() {
      return builder;
    },
    returning(selection: any) {
      if (!state.values) return Promise.resolve([]);
      if (table === usersTable) {
        return Promise.resolve(state.values.map((value: any, idx: number) => ({
          id: `user-${idx}`,
          email: value.email,
        })));
      }
      if (table === postsTable) {
        return Promise.resolve(state.values.map((value: any, idx: number) => ({
          id: `post-${idx}`,
          slug: value.slug,
          publishedAt: value.publishedAt ?? null,
        })));
      }
      return Promise.resolve([]);
    },
  };
  return builder;
});

const dbMock = { insert };

vi.mock("@/lib/logger", () => ({ default: logger }));
vi.mock("pg", () => ({ Client: FakeClient }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => dbMock }));
vi.mock("@/drizzle/schema", () => ({ users: usersTable, posts: postsTable, comments: commentsTable }));
vi.mock("crypto", () => ({ randomUUID: () => `uuid-${++uuidCounter}` }));
vi.mock("slugify", () => (str: string) => str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));

const BASE_ENV = { ...process.env };

describe("scripts/seed-posts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insertedUsers.length = 0;
    insertedPosts.length = 0;
    insertedComments.length = 0;
    uuidCounter = 0;
    connect.mockResolvedValue(undefined);
    end.mockResolvedValue(undefined);
    process.env = { ...BASE_ENV, DATABASE_URL: "postgres://seed" };
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T00:00:00Z"));
    const exitSpy = vi.spyOn(process, "exit");
    exitSpy.mockImplementation(((code?: number) => {
      throw new Error(`process.exit should not be called (code: ${code ?? "undefined"})`);
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    process.env = { ...BASE_ENV };
  });

  it("seeds users and posts via drizzle", async () => {
    await import("@/scripts/seed-posts");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(connect).toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(usersTable);
    expect(insert).toHaveBeenCalledWith(postsTable);

    expect(insertedUsers[0]).toHaveLength(5);
    expect(insertedPosts[0]?.length).toBeGreaterThan(0);
    expect(insertedComments.flat()).toHaveLength(0);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Upserted"));
    expect(logger.info).toHaveBeenCalledWith("No comments generated for this run.");
    expect(logger.error).not.toHaveBeenCalled();
  });
});
