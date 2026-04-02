/* eslint-disable prettier/prettier */
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async setCacheKey(key: string, value: any, ttl: number): Promise<void> {
    const data = await this.cacheManager.set(key, value, { ttl } as any);
    console.log('line 11', data);
  }

  async getObjectArrayCacheKey(key: string): Promise<any> {
    const data = await this.cacheManager.get(key);
    console.log('line 12', data);
    return data;
  }

  async getCacheKey(key: string): Promise<string> {
    const data = await this.cacheManager.get(key);
    console.log('line 12', data);
    return data as string;
  }

  async deleteCacheKey(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  // async resetCache(): Promise<void> {
  //   await this.cacheManager.reset() as any;
  // }

  // async cacheStore(): Promise<string[]> {
  //   return await this.cacheManager.stores.keys() as string[];
  // }
}
