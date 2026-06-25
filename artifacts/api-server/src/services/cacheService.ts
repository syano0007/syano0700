// ─── Generic in-process LRU Cache Service ────────────────────────────────────
//
// No external dependencies — same doubly-linked-list + Map O(1) pattern as
// searchCache.ts. Used for products list, product detail, categories, sellers.

interface LRUNode<T> {
  key: string;
  value: T;
  expiresAt: number;
  prev: LRUNode<T> | null;
  next: LRUNode<T> | null;
}

export interface CacheServiceStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export class CacheService<T> {
  private readonly map = new Map<string, LRUNode<T>>();
  private head: LRUNode<T> | null = null; // MRU
  private tail: LRUNode<T> | null = null; // LRU
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;

  constructor(
    private readonly maxSize: number,
    private readonly defaultTtlMs: number,
  ) {}

  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) {
      this._misses++;
      return undefined;
    }
    if (Date.now() > node.expiresAt) {
      this._removeNode(node);
      this.map.delete(key);
      this._misses++;
      return undefined;
    }
    this._moveToFront(node);
    this._hits++;
    return node.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this._moveToFront(existing);
      return;
    }
    if (this.map.size >= this.maxSize && this.tail) {
      this.map.delete(this.tail.key);
      this._removeNode(this.tail);
      this._evictions++;
    }
    const node: LRUNode<T> = { key, value, expiresAt, prev: null, next: null };
    this._insertAtFront(node);
    this.map.set(key, node);
  }

  delete(key: string): void {
    const node = this.map.get(key);
    if (node) {
      this._removeNode(node);
      this.map.delete(key);
    }
  }

  deleteByPrefix(prefix: string): void {
    const toDelete: string[] = [];
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) toDelete.push(k);
    }
    for (const k of toDelete) {
      const node = this.map.get(k);
      if (node) { this._removeNode(node); this.map.delete(k); }
    }
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  size(): number {
    return this.map.size;
  }

  stats(): CacheServiceStats {
    const total = this._hits + this._misses;
    return {
      size:      this.map.size,
      maxSize:   this.maxSize,
      hits:      this._hits,
      misses:    this._misses,
      hitRate:   total > 0 ? Math.round((this._hits / total) * 1000) / 1000 : 0,
      evictions: this._evictions,
    };
  }

  private _moveToFront(node: LRUNode<T>): void {
    if (node === this.head) return;
    this._removeNode(node);
    this._insertAtFront(node);
  }

  private _insertAtFront(node: LRUNode<T>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private _removeNode(node: LRUNode<T>): void {
    if (node.prev) node.prev.next = node.next; else this.head = node.next;
    if (node.next) node.next.prev = node.prev; else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }
}

// ─── Typed cache instances ────────────────────────────────────────────────────

// Products list — invalidated on product create / update / delete
// TTL: 60s — short enough that price/stock changes are near-real-time
export const productsCache = new CacheService<Record<string, unknown>>(200, 60_000);

// Product detail — TTL 5 min, invalidated per-id on update/delete
export const productDetailCache = new CacheService<Record<string, unknown>>(500, 5 * 60_000);

// Categories — rarely changes, TTL 1 hr
export const categoriesCache = new CacheService<Record<string, unknown>>(10, 60 * 60_000);

// Sellers directory — TTL 2 min
export const sellersCache = new CacheService<Record<string, unknown>>(100, 2 * 60_000);

// Generic shared instance for miscellaneous use
export const cacheService = new CacheService<unknown>(1000, 5 * 60_000);
