// SPDX-License-Identifier: Apache-2.0
import { db } from "./db";
import { configuration, configValueType } from "../drizzle/schema";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const DEFAULT_TTL_MINUTES = 5;
const DEFAULT_SWR_MINUTES = 20;
const TTL_KEY = "SYSTEM.CACHE.DEFAULT-TTL";

export type ConfigType = (typeof configValueType.enumValues)[number];

export interface GetOptions {
  userId?: string | null;
  bypassCache?: boolean;
}

export interface SetGlobalOptions {
  type?: ConfigType; // required on first insert
  allowedValues?: unknown[] | null;
  required?: boolean;
  actorId?: string; // reserved for future audit use
}

export interface SetUserOptions {
  actorId?: string; // reserved for future audit use
}

export interface ConfigService {
  get<T = unknown>(key: string, opts?: GetOptions): Promise<T | null>;
  getString(key: string, opts?: GetOptions): Promise<string | null>;
  getNumber(key: string, opts?: GetOptions): Promise<number | null>;
  getBoolean(key: string, opts?: GetOptions): Promise<boolean | null>;
  getJSON<T = unknown>(key: string, opts?: GetOptions): Promise<T | null>;

  setGlobal(key: string, value: unknown, opts: SetGlobalOptions): Promise<void>;
  setUserOverride(key: string, userId: string, value: unknown, opts?: SetUserOptions): Promise<void>;
  deleteUserOverride(key: string, userId: string, opts?: SetUserOptions): Promise<void>;

  // Helper to check if user overrides are allowed for a key
  canUserOverride(key: string): boolean;

  invalidate(key: string, userId?: string | null | "*"): Promise<void>;
}

// Simple in-memory cache with TTL + SWR
interface CacheEntry<T = unknown> {
  value: T;
  ttlAt: number;
  swrAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  get<T>(k: string): CacheEntry<T> | undefined {
    return this.store.get(k) as CacheEntry<T> | undefined;
  }
  set<T>(k: string, e: CacheEntry<T>) {
    this.store.set(k, e as CacheEntry);
  }
  del(k: string) {
    this.store.delete(k);
  }
}

// Single-flight dedupe
const inflight = new Map<string, Promise<unknown>>();
function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export interface Repo {
  readEffective(key: string, userId: string | null): Promise<any | null>;
  upsertGlobal(key: string, type: ConfigType, value: unknown, allowedValues: unknown[] | null, required: boolean): Promise<void>;
  getGlobalType(key: string): Promise<ConfigType | null>;
  upsertUser(key: string, userId: string, type: ConfigType, value: unknown): Promise<void>;
  deleteUser(key: string, userId: string): Promise<void>;
  getGlobalNumber(key: string): Promise<number | null>;
}

class DrizzleRepo implements Repo {
  constructor(private db: NodePgDatabase) {}

  async readEffective(key: string, userId: string | null) {
    if (userId) {
      const rows = await this.db
        .select({ value: configuration.value })
        .from(configuration)
        .where(and(eq(configuration.key, key), or(eq(configuration.userId, userId), isNull(configuration.userId))))
        .orderBy(asc(sql`(${configuration.userId.name} is null)`))
        .limit(1);
      return rows[0]?.value ?? null;
    } else {
      const rows = await this.db
        .select({ value: configuration.value })
        .from(configuration)
        .where(and(eq(configuration.key, key), isNull(configuration.userId)))
        .limit(1);
      return rows[0]?.value ?? null;
    }
  }

  async upsertGlobal(key: string, type: ConfigType, value: unknown, allowedValues: unknown[] | null, required: boolean) {
    // UPDATE then INSERT to respect partial unique index
    const updated = await this.db.execute(sql`
      with upsert as (
        update "configuration"
           set "type" = ${type},
               "value" = ${JSON.stringify(value)}::jsonb,
               "allowed_values" = ${allowedValues ? JSON.stringify(allowedValues) : null}::jsonb,
               "required" = ${required},
               "updated_at" = now()
         where "key" = ${key}
           and "user_id" is null
       returning 1
      )
      insert into "configuration" ("key","user_id","type","value","allowed_values","required")
      select ${key}, null, ${type}, ${JSON.stringify(value)}::jsonb, ${allowedValues ? JSON.stringify(allowedValues) : null}::jsonb, ${required}
      where not exists (select 1 from upsert);
    `);
    return void updated;
  }

  async getGlobalType(key: string) {
    const rows = await this.db
      .select({ type: configuration.type })
      .from(configuration)
      .where(and(eq(configuration.key, key), isNull(configuration.userId)))
      .limit(1);
    return rows[0]?.type ?? null;
  }

  async upsertUser(key: string, userId: string, type: ConfigType, value: unknown) {
    await this.db.execute(sql`
      insert into ${configuration} (${configuration.key}, ${configuration.userId}, ${configuration.type}, ${configuration.value})
      values (${key}, ${userId}::uuid, ${type}, ${JSON.stringify(value)}::jsonb)
      on conflict (${configuration.key}, ${configuration.userId})
      do update set ${configuration.value} = excluded.value, ${configuration.updatedAt} = now();
    `);
  }

  async deleteUser(key: string, userId: string) {
    await this.db
      .delete(configuration)
      .where(and(eq(configuration.key, key), eq(configuration.userId, userId)));
  }

  async getGlobalNumber(key: string): Promise<number | null> {
    const rows = await this.db
      .select({ value: configuration.value })
      .from(configuration)
      .where(and(eq(configuration.key, key), isNull(configuration.userId)))
      .limit(1);
    const v = rows[0]?.value;
    if (v == null) return null;
    if (typeof v === "number") return v;
    // if stored as json string or object, try to coerce
    try {
      if (typeof v === "string") return Number(v);
      return Number((v as any));
    } catch {
      return null;
    }
  }
}

function normalizeKey(input: string): string {
  const k = (input || "").trim().toUpperCase();
  const ok = /^[A-Z0-9-]+(\.[A-Z0-9-]+)*$/.test(k);
  if (!ok) throw new Error("Invalid configuration key format");
  return k;
}

function ensureType(value: unknown, type: ConfigType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "date":
    case "datetime":
      return typeof value === "string"; // ISO-8601 string recommended
    case "json":
      return true;
  }
}

function inAllowed(value: unknown, allowed: unknown[] | null | undefined): boolean {
  if (!allowed || !Array.isArray(allowed)) return true;
  return allowed.some((a) => JSON.stringify(a) === JSON.stringify(value));
}

function minutesToMs(m: number) {
  return Math.max(60_000, Math.round(m * 60_000));
}

function withJitter(ms: number, jitter = 0.1) {
  const delta = ms * jitter * (Math.random() * 2 - 1);
  return Math.max(1_000, Math.round(ms + delta));
}

export class ConfigServiceImpl implements ConfigService {
  private cache = new InMemoryCache();
  private repo: Repo;
  private ttlMinutesCache: { value: number; nextRefreshAt: number } = { value: DEFAULT_TTL_MINUTES, nextRefreshAt: 0 };
  private allowUserOverrides: Set<string>;

  constructor(opts?: { db?: NodePgDatabase; repo?: Repo; allowUserOverrides?: Set<string> }) {
    this.repo = opts?.repo ?? new DrizzleRepo(opts?.db ?? (db as any));
    this.allowUserOverrides = opts?.allowUserOverrides ?? new Set();
  }

  private cacheKey(key: string, userId: string | null) {
    return `config:${key}:${userId ?? "global"}`;
  }

  private async getTtlMinutes(): Promise<number> {
    const now = Date.now();
    if (now < this.ttlMinutesCache.nextRefreshAt) return this.ttlMinutesCache.value;
    const v = await this.repo.getGlobalNumber(TTL_KEY);
    let minutes = DEFAULT_TTL_MINUTES;
    if (typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 1440) minutes = v;
    this.ttlMinutesCache = { value: minutes, nextRefreshAt: now + 60_000 };
    return minutes;
  }

  async get<T = unknown>(key: string, opts?: GetOptions): Promise<T | null> {
    const k = normalizeKey(key);
    const u = opts?.userId ?? null;
    const ck = this.cacheKey(k, u);

    if (opts?.bypassCache) return this.readEffective<T>(k, u);

    const now = Date.now();
    const entry = this.cache.get<T>(ck);
    const ttlMs = minutesToMs(await this.getTtlMinutes());
    const swrMs = minutesToMs(DEFAULT_SWR_MINUTES);

    if (entry && now < entry.ttlAt) return entry.value;
    if (entry && now < entry.swrAt) {
      singleFlight(ck, () => this.readEffective<T>(k, u).then((v) => this.setCache(ck, v, ttlMs, swrMs)));
      return entry.value;
    }
    const value = await singleFlight(ck, () => this.readEffective<T>(k, u));
    this.setCache(ck, value, ttlMs, swrMs);
    return value;
  }

  async getString(key: string, opts?: GetOptions) {
    const v = await this.get<unknown>(key, opts);
    return typeof v === "string" ? v : null;
  }
  async getNumber(key: string, opts?: GetOptions) {
    const v = await this.get<unknown>(key, opts);
    return typeof v === "number" ? v : null;
  }
  async getBoolean(key: string, opts?: GetOptions) {
    const v = await this.get<unknown>(key, opts);
    return typeof v === "boolean" ? v : null;
  }
  async getJSON<T = unknown>(key: string, opts?: GetOptions) {
    const v = await this.get<unknown>(key, opts);
    return (v as T) ?? null;
  }

  private async readEffective<T>(k: string, u: string | null) {
    return (await this.repo.readEffective(k, u)) as T | null;
  }

  private setCache<T>(ck: string, value: T | null, ttlMs: number, swrMs: number) {
    const now = Date.now();
    this.cache.set(ck, { value: value as any, ttlAt: now + withJitter(ttlMs), swrAt: now + swrMs });
  }

  async setGlobal(key: string, value: unknown, opts: SetGlobalOptions): Promise<void> {
    const k = normalizeKey(key);
    const type = opts.type ?? (await this.repo.getGlobalType(k)) ?? null;
    if (!type) throw new Error("Global config type required on first set");
    if (!ensureType(value, type)) throw new Error("Value does not match declared type");
    if (!inAllowed(value, opts.allowedValues)) throw new Error("Value not in allowed_values");
    await this.repo.upsertGlobal(k, type, value, opts.allowedValues ?? null, !!opts.required);
    await this.invalidate(k, null);
  }

  async setUserOverride(key: string, userId: string, value: unknown, _opts?: SetUserOptions): Promise<void> {
    const k = normalizeKey(key);
    
    // Check if this key allows user overrides
    if (this.allowUserOverrides.size > 0 && !this.allowUserOverrides.has(k)) {
      throw new Error(`User overrides not allowed for key: ${k}`);
    }
    
    const type = await this.repo.getGlobalType(k);
    if (!type) throw new Error("Cannot set user override without existing global type");
    if (!ensureType(value, type)) throw new Error("Value does not match declared type");
    await this.repo.upsertUser(k, userId, type, value);
    await this.invalidate(k, userId);
  }

  async deleteUserOverride(key: string, userId: string): Promise<void> {
    const k = normalizeKey(key);
    
    // Check if this key allows user overrides
    if (this.allowUserOverrides.size > 0 && !this.allowUserOverrides.has(k)) {
      throw new Error(`User overrides not allowed for key: ${k}`);
    }
    
    await this.repo.deleteUser(k, userId);
    await this.invalidate(k, userId);
  }

  // Helper method to check if a key allows user overrides
  canUserOverride(key: string): boolean {
    const k = normalizeKey(key);
    return this.allowUserOverrides.size === 0 || this.allowUserOverrides.has(k);
  }

  async invalidate(key: string, userId?: string | null | "*") {
    const k = normalizeKey(key);
    const ck = this.cacheKey(k, userId && userId !== "*" ? userId : null);
    this.cache.del(ck);
    // No cross-process invalidation in MVP
  }
}

export const __testables__ = { normalizeKey, ensureType, inAllowed, minutesToMs, withJitter };
