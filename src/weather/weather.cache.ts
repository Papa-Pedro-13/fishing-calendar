import { Injectable } from '@nestjs/common';
import { CACHE_MAX_ENTRIES, STALE_TTL_MS } from './weather.constants';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

@Injectable()
export class WeatherCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  /** Свежая запись или undefined, если её нет либо TTL истёк. */
  get<T>(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (!entry || entry.expiresAt <= now) {
      return undefined;
    }

    return entry.value;
  }

  /** Истёкшая запись в пределах окна stale — для выдачи при сбое провайдера. */
  getStale<T>(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (!entry || entry.staleUntil <= now) {
      return undefined;
    }

    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next();

      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }

    this.entries.set(key, {
      value,
      expiresAt: now + ttlMs,
      staleUntil: now + STALE_TTL_MS,
    });
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
