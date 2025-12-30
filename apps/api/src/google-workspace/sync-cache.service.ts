import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../config/redis.service';
import { createHash } from 'crypto';

/**
 * Sync Cache Service
 * Stores last_sync_hash per sheet in Redis
 * Skips processing if sheet data hasn't changed
 */
@Injectable()
export class SyncCacheService {
  private readonly logger = new Logger(SyncCacheService.name);
  private readonly CACHE_KEY_PREFIX = 'sync_cache:sheet:';
  private readonly TTL_SECONDS = 24 * 60 * 60; // 24 hours

  constructor(private readonly redis: RedisService) {}

  /**
   * Compute hash from sheet data
   */
  computeHash(data: any[][]): string {
    const dataStr = JSON.stringify(data);
    return createHash('sha256').update(dataStr).digest('hex');
  }

  /**
   * Check if sheet has changed since last sync
   * Returns true if changed (should process), false if unchanged (skip)
   */
  async hasChanged(sheetId: string, tabName: string, currentData: any[][]): Promise<boolean> {
    const key = `${this.CACHE_KEY_PREFIX}${sheetId}:${tabName}`;
    const currentHash = this.computeHash(currentData);
    
    const lastHash = await this.redis.get(key);
    
    if (lastHash === currentHash) {
      this.logger.debug(`⏭️ Sheet ${sheetId}/${tabName} unchanged, skipping`);
      return false;
    }

    return true;
  }

  /**
   * Update the cached hash after successful processing
   */
  async updateHash(sheetId: string, tabName: string, data: any[][]): Promise<void> {
    const key = `${this.CACHE_KEY_PREFIX}${sheetId}:${tabName}`;
    const hash = this.computeHash(data);
    await this.redis.set(key, hash, this.TTL_SECONDS);
  }

  /**
   * Invalidate cache for a sheet (force re-sync)
   */
  async invalidate(sheetId: string, tabName?: string): Promise<void> {
    if (tabName) {
      const key = `${this.CACHE_KEY_PREFIX}${sheetId}:${tabName}`;
      await this.redis.del(key);
    } else {
      // Invalidate all tabs for this sheet
      const client = this.redis.getClient();
      const keys = await client.keys(`${this.CACHE_KEY_PREFIX}${sheetId}:*`);
      for (const key of keys) {
        await this.redis.del(key);
      }
    }
    this.logger.log(`🗑️ Cache invalidated for sheet ${sheetId}`);
  }

  /**
   * Get cache stats (for monitoring)
   */
  async getCacheStats(): Promise<{
    cachedSheets: number;
    totalKeys: number;
  }> {
    const client = this.redis.getClient();
    const keys = await client.keys(`${this.CACHE_KEY_PREFIX}*`);
    const uniqueSheets = new Set(keys.map(k => k.split(':')[2]));
    
    return {
      cachedSheets: uniqueSheets.size,
      totalKeys: keys.length,
    };
  }
}
