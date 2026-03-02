/**
 * Configuration management for Email Loop Agent
 */

import packageJson from './package.json';
import type { AgentConfig } from './types';

export const VERSION = packageJson.version;

export const MASTER_URL = process.env.MASTER_URL || 'http://localhost:3000';
export const AGENT_SECRET = process.env.AGENT_SECRET || 'change-me-in-production';
export const AGENT_NICKNAME = process.env.AGENT_NICKNAME || `agent-${Date.now()}`;

// Agent configuration (updated from server)
export let config: AgentConfig = {
    pollInterval: 60000,  // 60 seconds
    sendInterval: 2000,   // 2 seconds between emails
    batchSize: 10
};

// Agent token (received after registration)
export let agentToken: string | null = null;

/**
 * Update agent configuration
 */
export function updateConfig(newConfig: Partial<AgentConfig>): void {
    config = { ...config, ...newConfig };
}

/**
 * Set agent token
 */
export function setAgentToken(token: string): void {
    agentToken = token;
}

/**
 * Get agent token
 */
export function getAgentToken(): string | null {
    return agentToken;
}
