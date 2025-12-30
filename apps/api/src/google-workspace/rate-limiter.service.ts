import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../config/redis.service';

/**
 * Rate Limiter Service
 * Enforces max 60 requests/min to Google APIs
 * Implements exponential backoff on 429 errors
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly RATE_LIMIT_KEY = 'google_api:rate_limit';
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly WINDOW_SECONDS = 60;

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if we can make a request, and if so, consume a token
   * Returns true if request allowed, false if rate limited
   */
  async acquireToken(): Promise<boolean> {
    const client = this.redis.getClient();
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${this.RATE_LIMIT_KEY}:${now - (now % this.WINDOW_SECONDS)}`;

    const currentCount = await client.incr(windowKey);
    
    if (currentCount === 1) {
      await client.expire(windowKey, this.WINDOW_SECONDS + 5);
    }

    if (currentCount > this.MAX_REQUESTS_PER_MINUTE) {
      this.logger.warn(`⚠️ Rate limit reached: ${currentCount}/${this.MAX_REQUESTS_PER_MINUTE}`);
      return false;
    }

    return true;
  }

  /**
   * Get current quota usage percentage
   */
  async getQuotaUsage(): Promise<{ used: number; limit: number; percentage: number }> {
    const client = this.redis.getClient();
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${this.RATE_LIMIT_KEY}:${now - (now % this.WINDOW_SECONDS)}`;

    const used = parseInt(await client.get(windowKey) || '0', 10);
    const percentage = Math.round((used / this.MAX_REQUESTS_PER_MINUTE) * 100);

    if (percentage > 80) {
      this.logger.warn(`🚨 Quota usage above 80%: ${percentage}%`);
    }

    return {
      used,
      limit: this.MAX_REQUESTS_PER_MINUTE,
      percentage,
    };
  }

  /**
   * Wait for rate limit to reset
   */
  async waitForRateLimit(): Promise<void> {
    const client = this.redis.getClient();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % this.WINDOW_SECONDS);
    const windowEnd = windowStart + this.WINDOW_SECONDS;
    const waitTime = (windowEnd - now) * 1000;

    this.logger.log(`⏳ Rate limited. Waiting ${waitTime}ms for reset...`);
    await this.sleep(waitTime);
  }

  /**
   * Execute with exponential backoff on 429 errors
   * Retries: 2s -> 4s -> 8s -> 16s (max 4 retries)
   */
  async executeWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 4,
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check rate limit before attempting
      const canProceed = await this.acquireToken();
      if (!canProceed) {
        await this.waitForRateLimit();
      }

      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check for rate limit error (HTTP 429)
        if (error.code === 429 || error.message?.includes('429') || error.message?.includes('Rate Limit')) {
          const backoffMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s, 16s
          this.logger.warn(`🔄 429 error, backing off ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.sleep(backoffMs);
          continue;
        }

        // Non-retryable error, throw immediately
        throw error;
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
