/**
 * Email Loop Agent
 *
 * A lightweight distributed email sending agent.
 * Polls the master server for tasks and sends emails via SMTP.
 */

import nodemailer from 'nodemailer';
import { updateChecker } from './update-checker';
import { logger } from './logger';
import { LogUploader } from './log-uploader';
import packageJson from './package.json';

const VERSION = packageJson.version;

// 100+ real email client User-Agent strings for X-Mailer header
const EMAIL_CLIENTS = [
    // Microsoft Outlook (Windows)
    'Microsoft Outlook 16.0',
    'Microsoft Outlook 15.0',
    'Microsoft Outlook 14.0',
    'Microsoft Office Outlook 12.0',
    'Microsoft Outlook Express 6.00.2900.5512',
    'Microsoft Outlook 16.0.5134.1000',
    'Microsoft Outlook 16.0.4266.1001',
    'Microsoft Outlook 2019',
    'Microsoft Outlook 2016',
    'Microsoft Outlook 2013',

    // Apple Mail (macOS)
    'Apple Mail (2.3654.60.1)',
    'Apple Mail (2.3445.104.11)',
    'Apple Mail (2.3445.104.8)',
    'Apple Mail (16.0)',
    'Apple Mail (15.0)',
    'Apple Mail (14.0)',
    'Apple Mail (13.4)',
    'Apple Mail (13.0)',
    'Apple Mail (12.4)',
    'Apple Mail (11.5)',

    // Mozilla Thunderbird
    'Mozilla Thunderbird 102.0',
    'Mozilla Thunderbird 91.0',
    'Mozilla Thunderbird 78.0',
    'Mozilla Thunderbird 68.0',
    'Mozilla Thunderbird 60.0',
    'Thunderbird 102.3.0',
    'Thunderbird 91.11.0',
    'Thunderbird 78.14.0',

    // Gmail Web Interface
    'Gmail Web Client 1.0',
    'Gmail API Client 1.0',

    // Windows Mail
    'Windows Mail 6.0.6000.16386',
    'Windows Mail 7.0',
    'Windows Live Mail 15.4.3555.0308',
    'Windows Live Mail 16.4.3528.0331',

    // Yahoo Mail
    'YahooMailClassic/1.0',
    'YahooMailWebService/0.8',

    // Mailbird
    'Mailbird 2.9.60.0',
    'Mailbird 2.9.50.0',
    'Mailbird 2.8.0.0',

    // eM Client
    'eM Client 9.0.1317.0',
    'eM Client 8.2.1659.0',
    'eM Client 8.1.1054.0',
    'eM Client 7.2.38715.0',

    // Postbox
    'Postbox 7.0.59',
    'Postbox 6.1.15',

    // The Bat!
    'The Bat! 9.4.2',
    'The Bat! 9.3.4',
    'The Bat! 8.8.9',

    // Evolution
    'Evolution 3.44.0',
    'Evolution 3.38.0',
    'Evolution 3.36.0',

    // KMail
    'KMail 5.20.0',
    'KMail 5.18.0',

    // Claws Mail
    'Claws Mail 4.1.0',
    'Claws Mail 3.19.0',

    // Spark
    'Spark 2.11.14',
    'Spark 2.10.8',

    // Airmail
    'Airmail 5.5.2',
    'Airmail 5.0.9',

    // Canary Mail
    'Canary Mail 3.42',
    'Canary Mail 3.35',

    // ProtonMail
    'ProtonMail Web Client 4.0',
    'ProtonMail Bridge 2.4.0',
    'ProtonMail Bridge 2.3.0',

    // Zoho Mail
    'Zoho Mail 1.0',
    'ZohoMail-Client/1.0',

    // Outlook.com
    'Outlook-Express/7.0',
    'Outlook-iOS/709.2189456.prod.iphone',
    'Outlook-Android/2.2.176',

    // iOS Mail
    'iPhone Mail (16.0)',
    'iPhone Mail (15.6)',
    'iPhone Mail (15.0)',
    'iPad Mail (16.0)',
    'iPad Mail (15.0)',

    // Android Email Clients
    'Android Mail 6.0',
    'Android Mail 7.0',
    'Android Mail 8.0',
    'Samsung Email 6.1.30.0',
    'Samsung Email 6.1.20.3',

    // Outlook Mobile
    'Microsoft Outlook for iOS 4.2223.0',
    'Microsoft Outlook for Android 4.2223.0',
    'Outlook-iOS/4.2218.0',
    'Outlook-Android/4.2218.0',

    // Newton Mail
    'Newton Mail 11.0.85',
    'Newton Mail 10.0.45',

    // BlueMail
    'BlueMail 1.9.8.5',
    'BlueMail 1.9.7.42',

    // TypeApp
    'TypeApp 1.0',

    // Nine Email
    'Nine 4.8.3a',
    'Nine 4.7.5a',

    // Additional Outlook versions
    'Microsoft Outlook 16.0.15225.20288',
    'Microsoft Outlook 16.0.14931.20648',
    'Microsoft Outlook 16.0.14326.20404',
    'Microsoft Outlook 16.0.13801.20738',
    'Microsoft Outlook 16.0.13127.21668',

    // Additional Apple Mail versions
    'Apple Mail (2.3654.60.1.1)',
    'Apple Mail (2.3654.60.1.2)',
    'Apple Mail (2.3445.104.11.1)',

    // Additional Thunderbird versions
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Thunderbird/102.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Thunderbird/91.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:78.0) Gecko/20100101 Thunderbird/78.0',

    // Fastmail
    'Fastmail Web Client 1.0',

    // Tutanota
    'Tutanota Desktop 3.103.0',
    'Tutanota Desktop 3.102.0',

    // Hiri
    'Hiri 1.4.0',

    // Spike
    'Spike 3.5.0',
    'Spike 3.4.0',

    // Front
    'Front 1.0',

    // Missive
    'Missive 10.48.0',

    // Superhuman
    'Superhuman 1.0',
];

/**
 * Get a consistent X-Mailer header based on email address hash
 * Same email will always get the same client identifier
 */
function getXMailerForEmail(email: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Use absolute value and modulo to get index
    const index = Math.abs(hash) % EMAIL_CLIENTS.length;
    return EMAIL_CLIENTS[index];
}

// Configuration from environment
const MASTER_URL = process.env.MASTER_URL || 'http://localhost:3000';
const AGENT_SECRET = process.env.AGENT_SECRET || 'change-me-in-production';
const AGENT_NICKNAME = process.env.AGENT_NICKNAME || `agent-${Date.now()}`;

// Initialize logger
logger.init();

// Initialize log uploader
const logUploader = new LogUploader(MASTER_URL, logger.getLogsDir());

// Helper: Format timestamp for logs
function timestamp(): string {
    return new Date().toISOString();
}

// Helper: Log with timestamp (legacy, use logger instead)
function log(message: string): void {
    logger.info(message);
}

// Runtime state
let agentToken: string | null = null;
let config = {
    pollInterval: parseInt(process.env.POLL_INTERVAL || '60000'),  // Default: 1 minute
    sendInterval: parseInt(process.env.SEND_INTERVAL || '2000'),   // Default: 2 seconds
    batchSize: parseInt(process.env.BATCH_SIZE || '10'),           // Default: 10
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000') // Default: 10 seconds
};

// Queue management
let currentQueue: Task[] = [];
let isPollingEnabled = true;
let isShuttingDown = false;
let isProcessing = false; // Track if currently processing tasks

/**
 * Get current queue size
 */
function getQueueSize(): number {
    return currentQueue.length;
}

/**
 * Stop polling for new tasks
 */
function stopPolling(): void {
    isPollingEnabled = false;
    log('[Agent] Polling stopped - no new tasks will be fetched');
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
        log('[Agent] Shutdown already in progress...');
        return;
    }

    log(`\n[Agent] Received ${signal} - initiating graceful shutdown...`);
    isShuttingDown = true;

    // Stop accepting new tasks
    stopPolling();

    // Wait for all work to complete (queue empty AND not processing)
    if (currentQueue.length > 0 || isProcessing) {
        log(`[Agent] Waiting for work to complete...`);
        log(`[Agent] Queue size: ${currentQueue.length}, Processing: ${isProcessing}`);

        while (currentQueue.length > 0 || isProcessing) {
            await sleep(1000);
            if (currentQueue.length > 0 || isProcessing) {
                log(`[Agent] Queue size: ${currentQueue.length}, Processing: ${isProcessing}`);
            }
        }

        log('[Agent] All work completed and reported to master');
    } else {
        log('[Agent] No pending work');
    }

    // Stop log uploader
    logUploader.stop();

    // Close logger
    logger.close();

    log('[Agent] Shutdown complete. Goodbye!');
    process.exit(0);
}

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

// Helper: Random delay to simulate human behavior
function randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return sleep(delay);
}

// Get OAuth2 access token for Microsoft
async function getOAuth2AccessToken(clientId: string, refreshToken: string): Promise<string | null> {
    try {
        const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        const params = new URLSearchParams({
            client_id: clientId,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'https://outlook.office.com/SMTP.Send offline_access'
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[Agent] Failed to get OAuth2 token: ${error}`);
            return null;
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error(`[Agent] OAuth2 token request error:`, error);
        return null;
    }
}

// Register with master server
async function register(): Promise<boolean> {
    try {
        // Remove trailing slash from MASTER_URL to avoid double slashes
        const baseUrl = MASTER_URL.replace(/\/$/, '');
        const url = `${baseUrl}/api/agents/register`;

        log(`[Agent] Registering as "${AGENT_NICKNAME}" with master at ${url}...`);
        log(`[Agent] Secret: ${AGENT_SECRET?.substring(0, 10)}...`);
        log(`[Agent] Version: ${VERSION}`);

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
            console.error(`[Agent] Registration failed: ${error.error}`);
            return false;
        }

        const data = await response.json();
        agentToken = data.token;
        config = { ...config, ...data.config };

        log(`[Agent] Registered successfully!`);
        log(`[Agent] Config: poll=${config.pollInterval}ms, send=${config.sendInterval}ms, batch=${config.batchSize}`);

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

// Report results to master with retry mechanism
async function report(results: TaskResult[]): Promise<boolean> {
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

                // If this is not the last attempt, wait and retry
                if (attempt < MAX_RETRIES) {
                    logger.warn(`[Agent] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                    await sleep(RETRY_DELAY);
                    continue;
                }

                // Last attempt failed
                logger.error(`[Agent] Report failed after ${MAX_RETRIES} attempts. Results will be lost.`, {
                    results: results.map(r => ({
                        queueId: r.queueId,
                        success: r.success,
                        error: r.errorMessage
                    }))
                });
                return false;
            }

            // Success
            logger.info(`[Agent] Successfully reported ${results.length} result(s) to master`);
            return true;

        } catch (error) {
            logger.error(`[Agent] Report error (attempt ${attempt}/${MAX_RETRIES}):`, error);

            // If this is not the last attempt, wait and retry
            if (attempt < MAX_RETRIES) {
                logger.warn(`[Agent] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
                continue;
            }

            // Last attempt failed
            logger.error(`[Agent] Report failed after ${MAX_RETRIES} attempts due to network error. Results will be lost.`, {
                results: results.map(r => ({
                    queueId: r.queueId,
                    success: r.success,
                    error: r.errorMessage
                }))
            });
            return false;
        }
    }

    return false;
}

// Send health check heartbeat to master
async function sendHealthCheck(): Promise<boolean> {
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
            // Don't log errors for health checks to avoid spam
            // Re-register if token invalid
            if (response.status === 401) {
                agentToken = null;
            }
            return false;
        }

        return true;
    } catch (error) {
        // Silent failure for health checks
        return false;
    }
}

// Send a single email with human-like behavior
async function sendEmail(task: Task): Promise<TaskResult> {
    const { queueId, contact, campaign, smtp, subject, body, trackingId } = task;

    try {
        // Use pre-generated content from master
        if (!subject || !body) {
            throw new Error('Missing pre-generated email content');
        }

        const isSecure = smtp.secure === true;
        const authType = smtp.authType || 'basic';

        // Handle OAuth2 authentication for Outlook/Microsoft 365
        if (authType === 'oauth2') {
            log(`[Agent] Using OAuth2 authentication for ${smtp.email}`);

            // Get access token
            let accessToken: string | null | undefined = smtp.accessToken;

            // Check if token is expired or missing
            const needsRefresh = !accessToken ||
                (smtp.tokenExpiresAt && new Date(smtp.tokenExpiresAt) <= new Date());

            if (needsRefresh && smtp.clientId && smtp.refreshToken) {
                log(`[Agent] Refreshing OAuth2 access token...`);
                const token = await getOAuth2AccessToken(smtp.clientId, smtp.refreshToken);
                accessToken = token === null ? undefined : token;

                if (!accessToken) {
                    throw new Error('Failed to obtain OAuth2 access token');
                }
            }

            if (!accessToken) {
                throw new Error('No OAuth2 access token available');
            }

            // Use nodemailer with OAuth2 XOAUTH2
            const transportConfig = {
                host: smtp.host || 'smtp.office365.com',
                port: smtp.port || 587,
                secure: isSecure,
                auth: {
                    type: 'OAuth2',
                    user: smtp.email,
                    accessToken: accessToken
                }
            };

            const transporter = nodemailer.createTransport(transportConfig as nodemailer.TransportOptions);

            // Simulate human-like delays during connection
            await randomDelay(1000, 3000); // Initial connection delay

            // Send email
            const replyTo = campaign?.replyTo || smtp.email;
            const xMailer = getXMailerForEmail(smtp.email);

            await transporter.sendMail({
                from: smtp.email,
                to: contact.email,
                subject,
                html: body,
                replyTo,
                headers: {
                    'X-Mailer': xMailer,
                    'X-Priority': '3',
                }
            });

            // Post-send delay
            await randomDelay(2000, 5000);

            log(`[Agent] Sent email to ${contact.email} via ${smtp.email} (OAuth2)`);

            return {
                queueId,
                smtpId: smtp.id,
                smtpEmail: smtp.email,
                success: true,
                trackingId,
                subject,
                body
            };
        } else {
            // Basic password authentication
            log(`[Agent] Using basic authentication for ${smtp.email}`);

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

            // Simulate human-like delays
            await randomDelay(1000, 3000); // Initial connection delay

            // Send email
            const replyTo = campaign?.replyTo || smtp.email;
            const xMailer = getXMailerForEmail(smtp.email);

            await transporter.sendMail({
                from: smtp.email,
                to: contact.email,
                subject,
                html: body,
                replyTo,
                headers: {
                    'X-Mailer': xMailer,
                    'X-Priority': '3',
                }
            });

            // Post-send delay
            await randomDelay(2000, 5000);

            log(`[Agent] Sent email to ${contact.email} via ${smtp.email} (Basic Auth)`);

            return {
                queueId,
                smtpId: smtp.id,
                smtpEmail: smtp.email,
                success: true,
                trackingId,
                subject,
                body
            };
        }
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

// Health check loop - runs independently
async function healthCheckLoop() {
    while (true) {
        try {
            await sleep(config.healthCheckInterval);

            if (agentToken) {
                await sendHealthCheck();
            }
        } catch (error) {
            // Silent failure - health checks shouldn't crash the agent
        }
    }
}

// Main loop
async function main() {
    log(`[Agent] Email Loop Agent v${VERSION}`);
    log(`[Agent] Nickname: ${AGENT_NICKNAME}`);
    log(`[Agent] Master: ${MASTER_URL}`);
    log('');

    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    log('[Agent] Graceful shutdown handlers registered (SIGTERM, SIGINT)');

    // Register
    while (!agentToken) {
        const success = await register();
        if (!success) {
            log('[Agent] Retrying registration in 10 seconds...');
            await sleep(10000);
        }
    }

    // Start log uploader
    log('[Agent] Starting log uploader (interval: 30s)...');
    logUploader.setToken(agentToken);
    logUploader.start();

    // Start health check loop in background
    log(`[Agent] Starting health check loop (interval: ${config.healthCheckInterval}ms)...`);
    healthCheckLoop().catch(console.error);

    // Start update checker
    log('[Agent] Starting auto-update checker...');
    updateChecker.config.getQueueSize = getQueueSize;
    updateChecker.config.stopPolling = stopPolling;
    updateChecker.start();

    // Main polling loop
    log('[Agent] Starting polling loop...');

    while (true) {
        try {
            // Check if polling is disabled
            if (!isPollingEnabled) {
                // Process remaining queue
                if (currentQueue.length > 0) {
                    isProcessing = true;
                    log('[Agent] Polling is disabled, processing remaining queue...');
                    const task = currentQueue.shift()!;
                    const result = await sendEmail(task);

                    // Report with retry mechanism
                    const reportSuccess = await report([result]);
                    if (!reportSuccess) {
                        logger.warn('[Agent] Failed to report result after 5 retries, but continuing with remaining queue');
                    }

                    isProcessing = false;

                    if (currentQueue.length > 0) {
                        await sleep(config.sendInterval);
                    }
                } else if (!isProcessing) {
                    // Queue is empty and not processing - exit
                    log('[Agent] All work completed - exiting');
                    break;
                }

                // Wait before checking again
                await sleep(1000);
                continue;
            }

            // Poll for tasks
            const tasks = await poll();

            if (tasks.length > 0) {
                isProcessing = true;
                log(`[Agent] Received ${tasks.length} task(s)`);

                // Add to queue
                currentQueue.push(...tasks);
                log(`[Agent] Queue size: ${currentQueue.length}`);

                const results: TaskResult[] = [];

                // Process tasks sequentially with delay
                for (const task of tasks) {
                    const result = await sendEmail(task);
                    results.push(result);

                    // Remove from queue after processing
                    const index = currentQueue.indexOf(task);
                    if (index > -1) {
                        currentQueue.splice(index, 1);
                    }

                    // Delay between sends
                    if (tasks.indexOf(task) < tasks.length - 1) {
                        await sleep(config.sendInterval);
                    }
                }

                // Report results with retry mechanism
                const reportSuccess = await report(results);
                isProcessing = false;

                if (reportSuccess) {
                    log(`[Agent] Completed ${results.length} task(s), ${results.filter(r => r.success).length} successful`);
                } else {
                    log(`[Agent] Completed ${results.length} task(s), ${results.filter(r => r.success).length} successful, but failed to report to master after 5 retries`);
                }
                log(`[Agent] Queue size: ${currentQueue.length}`);
            }

            // Wait before next poll
            await sleep(config.pollInterval);

        } catch (error) {
            console.error('[Agent] Error in main loop:', error);
            isProcessing = false;
            await sleep(10000);
        }
    }
}

// Start
main().catch(console.error);
