/**
 * API client for communicating with Email Loop master server
 */

import { logger } from './logger';
import { sleep } from './utils';
import {
    MASTER_URL,
    AGENT_SECRET,
    AGENT_NICKNAME,
    VERSION,
    getAgentToken,
    setAgentToken,
    updateConfig
} from './config';
import type { Task, TaskResult, ImapTaskResult } from './types';

/**
 * Register agent with master server
 */
export async function register(): Promise<boolean> {
    try {
        const baseUrl = MASTER_URL.replace(/\/$/, '');
        const url = `${baseUrl}/api/agents/register`;

        logger.info(`[Agent] Registering as "${AGENT_NICKNAME}" with master at ${url}...`);
        logger.info(`[Agent] Secret: ${AGENT_SECRET?.substring(0, 10)}...`);
        logger.info(`[Agent] Version: ${VERSION}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Custom-Agent': 'RankScaleAIEmailAgent'
            },
            body: JSON.stringify({
                secret: AGENT_SECRET,
                nickname: AGENT_NICKNAME,
                version: VERSION
            })
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error(`[Agent] Registration failed: ${error.error}`);
            return false;
        }

        const data = await response.json();
        setAgentToken(data.token);
        updateConfig(data.config);

        logger.info(`[Agent] Registered successfully!`);
        logger.info(`[Agent] Config received from server`);

        return true;
    } catch (error) {
        logger.error(`[Agent] Registration error:`, error);
        return false;
    }
}

/**
 * Poll master server for tasks
 */
export async function poll(): Promise<Task[]> {
    const agentToken = getAgentToken();
    if (!agentToken) {
        logger.error('[Agent] Not registered, cannot poll');
        return [];
    }

    try {
        const baseUrl = MASTER_URL.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/agents/poll`, {
            method: 'GET',
            headers: {
                'X-Agent-Token': agentToken,
                'X-Agent-Version': VERSION,
                'X-Custom-Agent': 'RankScaleAIEmailAgent'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error(`[Agent] Poll failed: ${error.error}`);

            // Re-register if token invalid
            if (response.status === 401) {
                setAgentToken('');
            }
            return [];
        }

        const data = await response.json();

        // Update config if changed
        if (data.config) {
            updateConfig(data.config);
        }

        return data.tasks || [];
    } catch (error) {
        logger.error(`[Agent] Poll error:`, error);
        return [];
    }
}

/**
 * Report task results to master server with retry mechanism
 */
export async function report(results: TaskResult[]): Promise<boolean> {
    const agentToken = getAgentToken();
    if (!agentToken || results.length === 0) return true;

    const MAX_RETRIES = 5;
    const RETRY_DELAY = 30000; // 30 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.info(`[Agent] Reporting ${results.length} result(s) to master (attempt ${attempt}/${MAX_RETRIES})`);

            const baseUrl = MASTER_URL.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/api/agents/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Agent-Token': agentToken,
                    'X-Custom-Agent': 'RankScaleAIEmailAgent'
                },
                body: JSON.stringify({ results })
            });

            if (!response.ok) {
                const error = await response.json();
                logger.error(`[Agent] Report failed (attempt ${attempt}/${MAX_RETRIES}): ${error.error}`);

                if (attempt < MAX_RETRIES) {
                    logger.warn(`[Agent] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                    await sleep(RETRY_DELAY);
                    continue;
                }

                logger.error(`[Agent] Report failed after ${MAX_RETRIES} attempts. Results will be lost.`);
                return false;
            }

            logger.info(`[Agent] Successfully reported ${results.length} result(s) to master`);
            return true;

        } catch (error) {
            logger.error(`[Agent] Report error (attempt ${attempt}/${MAX_RETRIES}):`, error);

            if (attempt < MAX_RETRIES) {
                logger.warn(`[Agent] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
                continue;
            }

            logger.error(`[Agent] Report failed after ${MAX_RETRIES} attempts due to network error.`);
            return false;
        }
    }

    return false;
}

/**
 * Report IMAP results to master server with retry mechanism
 */
export async function reportImap(results: ImapTaskResult[]): Promise<boolean> {
    const agentToken = getAgentToken();
    if (!agentToken || results.length === 0) return true;

    const MAX_RETRIES = 5;
    const RETRY_DELAY = 30000; // 30 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.info(`[IMAP] Reporting ${results.length} result(s) (attempt ${attempt}/${MAX_RETRIES})`);

            const baseUrl = MASTER_URL.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/api/agents/report-imap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Agent-Token': agentToken,
                    'X-Custom-Agent': 'RankScaleAIEmailAgent'
                },
                body: JSON.stringify({ results })
            });

            if (!response.ok) {
                const error = await response.json();
                logger.error(`[IMAP] Report failed (attempt ${attempt}/${MAX_RETRIES}): ${error.error}`);

                if (attempt < MAX_RETRIES) {
                    logger.warn(`[IMAP] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                    await sleep(RETRY_DELAY);
                    continue;
                }
                return false;
            }

            logger.info(`[IMAP] Successfully reported ${results.length} result(s)`);
            return true;

        } catch (error) {
            logger.error(`[IMAP] Report error (attempt ${attempt}/${MAX_RETRIES}):`, error);
            if (attempt < MAX_RETRIES) {
                logger.warn(`[IMAP] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
            }
        }
    }
    return false;
}

/**
 * Send health check heartbeat to master server
 */
export async function sendHealthCheck(): Promise<boolean> {
    const agentToken = getAgentToken();
    if (!agentToken) return false;

    try {
        const baseUrl = MASTER_URL.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/agents/health`, {
            method: 'POST',
            headers: {
                'X-Agent-Token': agentToken,
                'X-Custom-Agent': 'RankScaleAIEmailAgent'
            }
        });

        if (!response.ok) {
            // Re-register if token invalid
            if (response.status === 401) {
                setAgentToken('');
            }
            return false;
        }

        return true;
    } catch (error) {
        // Silent failure for health checks
        return false;
    }
}

/**
 * Poll for IMAP tasks
 */
export async function pollImap(): Promise<any[]> {
    const agentToken = getAgentToken();
    if (!agentToken) {
        return [];
    }

    try {
        const baseUrl = MASTER_URL.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/agents/poll-imap`, {
            method: 'GET',
            headers: {
                'X-Agent-Token': agentToken,
                'X-Agent-Version': VERSION,
                'X-Custom-Agent': 'RankScaleAIEmailAgent'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                setAgentToken('');
            }
            return [];
        }

        const data = await response.json();
        return data.tasks || [];
    } catch (error) {
        logger.error(`[IMAP] Poll error:`, error);
        return [];
    }
}
