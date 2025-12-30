import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../config/redis.service';

/**
 * Circuit Breaker Service
 * Stops syncing a specific sheet if it fails 5 consecutive times
 * Auto-resets after 30 minutes
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly CIRCUIT_KEY_PREFIX = 'circuit_breaker:sheet:';
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if circuit is open (tripped) for a specific sheet
   */
  async isCircuitOpen(sheetId: string): Promise<boolean> {
    const client = this.redis.getClient();
    const key = `${this.CIRCUIT_KEY_PREFIX}${sheetId}`;
    const state = await client.hget(key, 'state');
    return state === 'OPEN';
  }

  /**
   * Record a failure for a sheet
   * Returns true if circuit just tripped
   */
  async recordFailure(sheetId: string, error: string): Promise<boolean> {
    const client = this.redis.getClient();
    const key = `${this.CIRCUIT_KEY_PREFIX}${sheetId}`;

    const failures = await client.hincrby(key, 'failures', 1);
    await client.hset(key, 'lastError', error);
    await client.hset(key, 'lastFailure', new Date().toISOString());
    await client.expire(key, this.RESET_TIMEOUT_SECONDS);

    if (failures >= this.FAILURE_THRESHOLD) {
      await client.hset(key, 'state', 'OPEN');
      await client.hset(key, 'trippedAt', new Date().toISOString());
      this.logger.error(`🔴 Circuit OPEN for sheet ${sheetId}: ${failures} consecutive failures`);
      return true;
    }

    return false;
  }

  /**
   * Record a success - resets the failure count
   */
  async recordSuccess(sheetId: string): Promise<void> {
    const client = this.redis.getClient();
    const key = `${this.CIRCUIT_KEY_PREFIX}${sheetId}`;
    await client.del(key);
  }

  /**
   * Manually reset a circuit (e.g., after fixing the issue)
   */
  async resetCircuit(sheetId: string): Promise<void> {
    const client = this.redis.getClient();
    const key = `${this.CIRCUIT_KEY_PREFIX}${sheetId}`;
    await client.del(key);
    this.logger.log(`🟢 Circuit manually reset for sheet ${sheetId}`);
  }

  /**
   * Get circuit status for all sheets (for dashboard)
   */
  async getAllCircuitStates(): Promise<Array<{
    sheetId: string;
    state: 'OPEN' | 'CLOSED';
    failures: number;
    lastError?: string;
    trippedAt?: string;
  }>> {
    const client = this.redis.getClient();
    const keys = await client.keys(`${this.CIRCUIT_KEY_PREFIX}*`);
    const states: any[] = [];

    for (const key of keys) {
      const sheetId = key.replace(this.CIRCUIT_KEY_PREFIX, '');
      const data = await client.hgetall(key);
      states.push({
        sheetId,
        state: data.state === 'OPEN' ? 'OPEN' : 'CLOSED',
        failures: parseInt(data.failures || '0', 10),
        lastError: data.lastError,
        trippedAt: data.trippedAt,
      });
    }

    return states;
  }

  /**
   * Get count of open circuits
   */
  async getOpenCircuitCount(): Promise<number> {
    const states = await this.getAllCircuitStates();
    return states.filter(s => s.state === 'OPEN').length;
  }
}
