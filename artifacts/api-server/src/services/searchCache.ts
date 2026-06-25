import { createHash } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchCacheValue = Record<string, unknown>;

interface CacheEntry {
  key: string;
  value: SearchCacheValue;
  createdAt: number;
  ttl: number;
  hits: number;
  queryText: string;
}

interface ListNode {
  prev: ListNode | null;
  next: ListNode | null;
  key: string;
  entry: CacheEntry;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  memoryEstimateMB: number;
  oldestEntryAge: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE = 500;
export const TTL_NORMAL     = 300_000;  // 5 minutes
export const TTL_SALE       = 60_000;   // 1 minute (sale / new_arrivals change fast)
export const TTL_FALLBACK_L4 = 600_000; // 10 minutes (trending — stable)

// ─── LRU Cache (doubly-linked list + Map — O(1) get/set/evict) ───────────────

class LRUSearchCache {
  private readonly map = new Map<string, ListNode>();
  private head: ListNode | null = null; // most-recently-used end
  private tail: ListNode | null = null; // least-recently-used end
  private _totalHits = 0;
  private _totalMisses = 0;
  private _totalEvictions = 0;

  get(key: string): SearchCacheValue | null {
    const node = this.map.get(key);
    if (!node) { this._totalMisses++; return null; }

    const entry = node.entry;
    if (Date.now() > entry.createdAt + entry.ttl) {
      this.removeNode(node);
      this.map.delete(key);
      this._totalMisses++;
      return null;
    }

    this.moveToFront(node);
    entry.hits++;
    this._totalHits++;
    return entry.value;
  }

  set(key: string, value: SearchCacheValue, ttl: number, queryText: string): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.entry.value = value;
      existing.entry.createdAt = Date.now();
      existing.entry.ttl = ttl;
      this.moveToFront(existing);
      return;
    }

    if (this.map.size >= MAX_SIZE && this.tail) {
      this.map.delete(this.tail.key);
      this.removeNode(this.tail);
      this._totalEvictions++;
    }

    const entry: CacheEntry = { key, value, createdAt: Date.now(), ttl, hits: 0, queryText };
    const node: ListNode = { prev: null, next: null, key, entry };
    this.insertAtFront(node);
    this.map.set(key, node);
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.map.clear();
      this.head = null;
      this.tail = null;
      return;
    }
    const toDelete: string[] = [];
    for (const k of this.map.keys()) {
      if (k.includes(pattern)) toDelete.push(k);
    }
    for (const k of toDelete) {
      const node = this.map.get(k);
      if (node) { this.removeNode(node); this.map.delete(k); }
    }
  }

  getStats(): CacheStats {
    const total = this._totalHits + this._totalMisses;
    const hitRate = total > 0 ? this._totalHits / total : 0;
    const oldestEntryAge = this.tail
      ? Math.floor((Date.now() - this.tail.entry.createdAt) / 1000)
      : 0;
    const memoryEstimateMB = Math.round((this.map.size * 50 * 1024) / (1024 * 1024) * 10) / 10;

    return {
      size: this.map.size,
      maxSize: MAX_SIZE,
      hitRate: Math.round(hitRate * 1000) / 1000,
      totalHits: this._totalHits,
      totalMisses: this._totalMisses,
      totalEvictions: this._totalEvictions,
      memoryEstimateMB,
      oldestEntryAge,
    };
  }

  getTopQueries(n: number): string[] {
    const entries: { queryText: string; hits: number }[] = [];
    for (const node of this.map.values()) {
      entries.push({ queryText: node.entry.queryText, hits: node.entry.hits });
    }
    return entries
      .sort((a, b) => b.hits - a.hits)
      .slice(0, n)
      .map(e => e.queryText);
  }

  // ── Linked-list helpers ──────────────────────────────────────────────────

  private moveToFront(node: ListNode): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.insertAtFront(node);
  }

  private insertAtFront(node: ListNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: ListNode): void {
    if (node.prev) node.prev.next = node.next; else this.head = node.next;
    if (node.next) node.next.prev = node.prev; else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }
}

export const searchCache = new LRUSearchCache();

// ─── Cache key builder ───────────────────────────────────────────────────────

export interface CacheKeyParams {
  normalizedQuery: string;
  sortBy: string;
  category: string | null;
  priceMin: number | null;
  priceMax: number | null;
  page: number;
  limit: number;
  inStock: boolean;
  hasDiscount: boolean;
  storeId: number | null;
  minRating: number | null;
}

export function buildCacheKey(params: CacheKeyParams): string {
  const raw = [
    params.normalizedQuery,
    params.sortBy,
    params.category    ?? "",
    params.priceMin    ?? "",
    params.priceMax    ?? "",
    params.page,
    params.limit,
    params.inStock     ? "1" : "0",
    params.hasDiscount ? "1" : "0",
    params.storeId     ?? "",
    params.minRating   ?? "",
  ].join("|");
  return createHash("md5").update(raw).digest("hex");
}

// ─── TTL selector ────────────────────────────────────────────────────────────

export function getTTL(detectedIntent: string | null, fallbackLevel: number | null): number {
  if (fallbackLevel === 4) return TTL_FALLBACK_L4;
  if (detectedIntent === "on_sale" || detectedIntent === "new_arrivals") return TTL_SALE;
  return TTL_NORMAL;
}
