/**
 * Event Queue with Batching
 *
 * Following Segment's batching pattern with backpressure handling:
 * - Events are queued until batch size is reached or flush interval fires
 * - Queue has a maximum size to prevent memory exhaustion
 * - forceFlush() sends all pending events immediately
 * - shutdown() cleans up resources
 */

import { BATCH_LIMITS, SHUTDOWN_CONFIG } from '@lattice.black/core';
import type { BatchConfig } from '@lattice.black/core';
import { defaultErrorHandler, type ErrorHandler } from './safe-wrapper';

/**
 * Callback for flushing events
 */
export type FlushCallback<T> = (events: T[]) => Promise<void>;

/**
 * Event queue configuration
 */
export interface EventQueueConfig<T> extends BatchConfig {
  /** Callback to flush events to the backend */
  onFlush: FlushCallback<T>;
  /** Error handler for failed flushes */
  onError?: ErrorHandler;
  /** Whether the queue is enabled */
  enabled?: boolean;
}

/**
 * Queue state for monitoring
 */
export interface QueueState {
  /** Current number of events in queue */
  size: number;
  /** Number of events dropped due to queue overflow */
  dropped: number;
  /** Number of successful flushes */
  flushCount: number;
  /** Number of failed flushes */
  failedFlushCount: number;
  /** Whether the queue is currently flushing */
  isFlushing: boolean;
  /** Whether the queue has been shut down */
  isShutdown: boolean;
}

/**
 * Generic event queue with batching and backpressure
 */
export class EventQueue<T> {
  private queue: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private isShutdown = false;
  private droppedCount = 0;
  private flushCount = 0;
  private failedFlushCount = 0;
  private readonly config: EventQueueConfig<T>;

  constructor(config: EventQueueConfig<T>) {
    // Validate and clamp configuration values
    this.config = {
      ...config,
      maxBatchSize: this.clamp(
        config.maxBatchSize,
        BATCH_LIMITS.MIN_BATCH_SIZE,
        BATCH_LIMITS.MAX_BATCH_SIZE
      ),
      flushIntervalMs: this.clamp(
        config.flushIntervalMs,
        BATCH_LIMITS.MIN_FLUSH_INTERVAL,
        BATCH_LIMITS.MAX_FLUSH_INTERVAL
      ),
      maxQueueSize: this.clamp(
        config.maxQueueSize,
        BATCH_LIMITS.MIN_QUEUE_SIZE,
        BATCH_LIMITS.MAX_QUEUE_SIZE
      ),
      onError: config.onError ?? defaultErrorHandler,
      enabled: config.enabled ?? true,
    };

    // Start the flush timer if enabled
    if (this.config.enabled) {
      this.startTimer();
    }
  }

  /**
   * Add an event to the queue
   * Returns true if event was queued, false if dropped due to backpressure
   */
  enqueue(event: T): boolean {
    if (this.isShutdown || !this.config.enabled) {
      return false;
    }

    // Check backpressure
    if (this.queue.length >= this.config.maxQueueSize) {
      this.droppedCount++;
      this.config.onError?.(
        new Error(`Queue full (${this.config.maxQueueSize}), dropping event`),
        'EventQueue.enqueue'
      );
      return false;
    }

    this.queue.push(event);

    // Flush immediately if batch size reached
    if (this.queue.length >= this.config.maxBatchSize) {
      this.flush().catch(() => {
        // Error already handled in flush()
      });
    }

    return true;
  }

  /**
   * Flush events up to batch size
   * Called automatically by timer or when batch size is reached
   */
  async flush(): Promise<void> {
    if (this.isShutdown || this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      // Take up to maxBatchSize events from the front of the queue
      const batch = this.queue.splice(0, this.config.maxBatchSize);

      if (batch.length > 0) {
        await this.config.onFlush(batch);
        this.flushCount++;
      }
    } catch (error) {
      this.failedFlushCount++;
      if (error instanceof Error) {
        this.config.onError?.(error, 'EventQueue.flush');
      }
      // Note: We don't re-queue failed events to prevent infinite loops
      // In production, consider a retry mechanism with backoff
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Force flush all pending events immediately
   * Used during shutdown or when immediate delivery is required
   */
  async forceFlush(timeoutMs: number = SHUTDOWN_CONFIG.DEFAULT_FLUSH_TIMEOUT): Promise<void> {
    if (this.isShutdown) {
      return;
    }

    // Stop the timer to prevent concurrent flushes
    this.stopTimer();

    const startTime = Date.now();

    // Keep flushing until queue is empty or timeout
    while (this.queue.length > 0 && Date.now() - startTime < timeoutMs) {
      await this.flush();

      // Small delay to prevent tight loop if flush fails
      if (this.queue.length > 0) {
        await this.sleep(100);
      }
    }

    // Restart timer if not shutting down
    if (!this.isShutdown && this.config.enabled) {
      this.startTimer();
    }
  }

  /**
   * Shut down the queue
   * Stops accepting new events and clears resources
   */
  shutdown(): void {
    this.isShutdown = true;
    this.stopTimer();
    this.queue = [];
  }

  /**
   * Get current queue state for monitoring
   */
  getState(): QueueState {
    return {
      size: this.queue.length,
      dropped: this.droppedCount,
      flushCount: this.flushCount,
      failedFlushCount: this.failedFlushCount,
      isFlushing: this.isFlushing,
      isShutdown: this.isShutdown,
    };
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get the number of pending events
   */
  size(): number {
    return this.queue.length;
  }

  // Private methods

  private startTimer(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.flush().catch(() => {
        // Error already handled in flush()
      });
    }, this.config.flushIntervalMs);

    // Don't prevent process exit
    this.timer.unref();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create an event queue with default configuration
 */
export function createEventQueue<T>(
  onFlush: FlushCallback<T>,
  config?: Partial<Omit<EventQueueConfig<T>, 'onFlush'>>
): EventQueue<T> {
  return new EventQueue({
    maxBatchSize: 10,
    flushIntervalMs: 5000,
    maxQueueSize: 1000,
    ...config,
    onFlush,
  });
}
