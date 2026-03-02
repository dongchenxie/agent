/**
 * Task queue management for Email Loop Agent
 *
 * IMPORTANT: This module manages the in-memory task queue.
 * To prevent memory leaks, tasks MUST be removed after processing.
 */

import type { Task } from './types';
import { logger } from './logger';

// In-memory task queue
let currentQueue: Task[] = [];

/**
 * Get current queue size
 */
export function getQueueSize(): number {
    return currentQueue.length;
}

/**
 * Get all tasks in queue
 */
export function getAllTasks(): Task[] {
    return [...currentQueue];
}

/**
 * Add tasks to queue
 */
export function addTasks(tasks: Task[]): void {
    currentQueue.push(...tasks);
    logger.info(`[Queue] Added ${tasks.length} tasks. Queue size: ${currentQueue.length}`);
}

/**
 * Remove task from queue by index
 * CRITICAL: Always call this after processing a task to prevent memory leaks
 */
export function removeTaskByIndex(index: number): void {
    if (index >= 0 && index < currentQueue.length) {
        const task = currentQueue[index];
        currentQueue.splice(index, 1);
        logger.debug(`[Queue] Removed task ${task.queueId}. Queue size: ${currentQueue.length}`);
    }
}

/**
 * Get and remove first task from queue (FIFO)
 * Returns undefined if queue is empty
 */
export function shiftTask(): Task | undefined {
    const task = currentQueue.shift();
    if (task) {
        logger.debug(`[Queue] Shifted task ${task.queueId}. Queue size: ${currentQueue.length}`);
    }
    return task;
}

/**
 * Clear all tasks from queue
 * Use with caution - only during shutdown
 */
export function clearQueue(): void {
    const size = currentQueue.length;
    currentQueue = [];
    logger.info(`[Queue] Cleared ${size} tasks from queue`);
}

/**
 * Check if queue is empty
 */
export function isQueueEmpty(): boolean {
    return currentQueue.length === 0;
}

/**
 * Get memory usage statistics
 */
export function getMemoryStats(): { queueSize: number; heapUsedMB: number; heapTotalMB: number } {
    const usage = process.memoryUsage();
    return {
        queueSize: currentQueue.length,
        heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024)
    };
}
