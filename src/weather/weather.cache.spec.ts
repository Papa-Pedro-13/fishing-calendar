import { WeatherCache } from './weather.cache';
import { CACHE_MAX_ENTRIES, STALE_TTL_MS } from './weather.constants';

describe('WeatherCache', () => {
  let cache: WeatherCache;

  beforeEach(() => {
    cache = new WeatherCache();
  });

  it('отдаёт свежую запись в пределах TTL', () => {
    cache.set('wx:current:moscow', { value: 1 }, 1000, 0);

    expect(cache.get('wx:current:moscow', 999)).toEqual({ value: 1 });
    expect(cache.get('wx:current:moscow', 1000)).toBeUndefined();
  });

  it('отдаёт устаревшую запись в пределах stale-окна', () => {
    cache.set('wx:current:moscow', { value: 1 }, 1000, 0);

    expect(cache.getStale('wx:current:moscow', 2000)).toEqual({ value: 1 });
    expect(
      cache.getStale('wx:current:moscow', STALE_TTL_MS + 1)
    ).toBeUndefined();
  });

  it('не отдаёт чужой ключ', () => {
    cache.set('wx:current:moscow', { value: 1 }, 1000, 0);

    expect(cache.get('wx:current:spb', 0)).toBeUndefined();
    expect(cache.getStale('wx:current:spb', 0)).toBeUndefined();
  });

  it('вытесняет самую старую запись при переполнении', () => {
    for (let i = 0; i < CACHE_MAX_ENTRIES; i += 1) {
      cache.set(`key-${i}`, i, 60_000, 0);
    }

    cache.set('key-new', 'new', 60_000, 0);

    expect(cache.size).toBe(CACHE_MAX_ENTRIES);
    expect(cache.get('key-0', 0)).toBeUndefined();
    expect(cache.get('key-new', 0)).toBe('new');
  });

  it('clear очищает кэш', () => {
    cache.set('key', 1, 60_000, 0);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('key', 0)).toBeUndefined();
  });
});
