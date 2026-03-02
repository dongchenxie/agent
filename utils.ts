/**
 * Utility functions for Email Loop Agent
 */

import { logger } from './logger';

/**
 * Get current timestamp in ISO format
 */
export function timestamp(): string {
    return new Date().toISOString();
}

/**
 * Log message with timestamp
 */
export function log(message: string): void {
    logger.info(message);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for random duration between min and max milliseconds
 */
export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await sleep(delay);
}
