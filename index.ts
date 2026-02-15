/**
 * Email Loop Agent
 *
 * A lightweight distributed email sending agent.
 * Polls the master server for tasks and sends emails via SMTP.
 */

import nodemailer from 'nodemailer';

const VERSION = '1.0.0';

// Configuration from environment
const MASTER_URL = process.env.MASTER_URL || 'http://localhost:3000';
const AGENT_SECRET = process.env.AGENT_SECRET || 'change-me-in-production';
const AGENT_NICKNAME = process.env.AGENT_NICKNAME || `agent-${Date.now()}`;

// Runtime state
let agentToken: string | null = null;
let config = {
    pollInterval: 60000,  // 1 minute
    sendInterval: 2000,   // 2 seconds
    batchSize: 10
};

interface Task {
    queueId: number;
    campaignId: number;
    // Pre-generated email content from master
    subject: string;
    body: string;
    trackingId: string;
    contact: {
        id: number;
        email: string;
        firstName?: string;
        lastName?: string;
        company?: string;
        website?: string;
    };
    campaign: {
        name: string;
        replyTo?: string;
    };
    smtp: {
        id: number;
        email: string;
        password: string;
        host?: string;
        port?: number;
        secure?: boolean;
        authType?: string;
        clientId?: string;
        clientSecret?: string;
        refreshToken?: string;
        tenantId?: string;
        accessToken?: string;
        tokenExpiresAt?: string;
    };
}

interface TaskResult {
    queueId: number;
    smtpId: number;
    smtpEmail: string;
    success: boolean;
    trackingId?: string;
    subject?: string;
    body?: string;
    errorMessage?: string;
}

// Helper: Sleep
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Register with master server
async function register(): Promise<boolean> {
    try {
        console.log(`[Agent] Registering as "${AGENT_NICKNAME}" with master at ${MASTER_URL}...`);

        const response = await fetch(`${MASTER_URL}/api/agents/register`, {
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
            console.error(`[Agent] Registration failed: ${error.error}`);
            return false;
        }

        const data = await response.json();
        agentToken = data.token;
        config = { ...config, ...data.config };

        console.log(`[Agent] Registered successfully!`);
        console.log(`[Agent] Config: poll=${config.pollInterval}ms, send=${config.sendInterval}ms, batch=${config.batchSize}`);

        return true;
    } catch (error) {
        console.error(`[Agent] Registration error:`, error);
        return false;
    }
}

// Poll for tasks
async function poll(): Promise<Task[]> {
    if (!agentToken) {
        console.error('[Agent] Not registered, cannot poll');
        return [];
    }

    try {
        const response = await fetch(`${MASTER_URL}/api/agents/poll`, {
            method: 'GET',
            headers: {
                'X-Agent-Token': agentToken,
                'X-Agent-Version': VERSION,
                'X-Custom-Agent': 'RankScaleAIEmailAgent'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`[Agent] Poll failed: ${error.error}`);

            // Re-register if token invalid
            if (response.status === 401) {
                agentToken = null;
            }
            return [];
        }

        const data = await response.json();

        // Update config if changed
        if (data.config) {
            config = { ...config, ...data.config };
        }

        return data.tasks || [];
    } catch (error) {
        console.error(`[Agent] Poll error:`, error);
        return [];
    }
}

// Report results to master
async function report(results: TaskResult[]): Promise<boolean> {
    if (!agentToken || results.length === 0) return true;

    try {
        const response = await fetch(`${MASTER_URL}/api/agents/report`, {
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
            console.error(`[Agent] Report failed: ${error.error}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`[Agent] Report error:`, error);
        return false;
    }
}

// Send a single email
async function sendEmail(task: Task): Promise<TaskResult> {
    const { queueId, contact, campaign, smtp, subject, body, trackingId } = task;

    try {
        // Use pre-generated content from master
        if (!subject || !body) {
            throw new Error('Missing pre-generated email content');
        }

        // Create transporter
        const isSecure = smtp.secure === true;
        const transportConfig = {
            host: smtp.host || 'smtp.gmail.com',
            port: smtp.port || 587,
            secure: isSecure,
            requireTLS: !isSecure,
            auth: {
                user: smtp.email,
                pass: smtp.password
            },
            tls: {
                rejectUnauthorized: isSecure
            }
        };

        const transporter = nodemailer.createTransport(transportConfig as nodemailer.TransportOptions);

        // Send email
        const replyTo = campaign.replyTo || smtp.email;

        await transporter.sendMail({
            from: smtp.email,
            to: contact.email,
            subject,
            html: body,
            replyTo
        });

        console.log(`[Agent] Sent email to ${contact.email} via ${smtp.email}`);

        return {
            queueId,
            smtpId: smtp.id,
            smtpEmail: smtp.email,
            success: true,
            trackingId,
            subject,
            body
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Agent] Failed to send to ${contact.email}: ${errorMessage}`);

        return {
            queueId,
            smtpId: smtp.id,
            smtpEmail: smtp.email,
            success: false,
            errorMessage
        };
    }
}

// Main loop
async function main() {
    console.log(`[Agent] Email Loop Agent v${VERSION}`);
    console.log(`[Agent] Nickname: ${AGENT_NICKNAME}`);
    console.log(`[Agent] Master: ${MASTER_URL}`);
    console.log('');

    // Register
    while (!agentToken) {
        const success = await register();
        if (!success) {
            console.log('[Agent] Retrying registration in 10 seconds...');
            await sleep(10000);
        }
    }

    // Main polling loop
    console.log('[Agent] Starting polling loop...');

    while (true) {
        try {
            // Poll for tasks
            const tasks = await poll();

            if (tasks.length > 0) {
                console.log(`[Agent] Received ${tasks.length} task(s)`);

                const results: TaskResult[] = [];

                // Process tasks sequentially with delay
                for (const task of tasks) {
                    const result = await sendEmail(task);
                    results.push(result);

                    // Delay between sends
                    if (tasks.indexOf(task) < tasks.length - 1) {
                        await sleep(config.sendInterval);
                    }
                }

                // Report results
                await report(results);

                console.log(`[Agent] Completed ${results.length} task(s), ${results.filter(r => r.success).length} successful`);
            }

            // Wait before next poll
            await sleep(config.pollInterval);

        } catch (error) {
            console.error('[Agent] Error in main loop:', error);
            await sleep(10000);
        }
    }
}

// Start
main().catch(console.error);
