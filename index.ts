/**
 * Email Loop Agent
 *
 * A lightweight distributed email sending agent.
 * Polls the master server for tasks and sends emails via SMTP.
 */

import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { createHash } from 'crypto';
import { updateChecker } from './update-checker';
import { logger } from './logger';
import { LogUploader } from './log-uploader';
import packageJson from './package.json';
import * as fs from 'fs';
import * as path from 'path';

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

const EHLO_BASE_DOMAINS = [
    'node1.mailinfra.net',
    'node2.mailinfra.net',
    'edge1.mailinfra.net',
    'edge2.mailinfra.net',
    'outbound1.mxpool.net',
    'outbound2.mxpool.net',
    'relay1.clientnet.net',
    'relay2.clientnet.net',
];

type DeviceClass = 'desktop' | 'laptop' | 'mac';
type ClientFamily = 'outlook_win' | 'outlook_mac' | 'thunderbird_win' | 'thunderbird_linux' | 'apple_mail';

interface ClientProfile {
    clientFamily: ClientFamily;
    deviceClass: DeviceClass;
    deviceName: string;
    ehloNode: string;
    ehloName: string;
    headers: Record<string, string>;
    postHandshakeDelayMinMs: number;
    postHandshakeDelayMaxMs: number;
    postSendDelayMinMs: number;
    postSendDelayMaxMs: number;
}

interface ImapClientProfile {
    clientFamily: ClientFamily;
    deviceClass: DeviceClass;
    deviceName: string;
    localHostName: string;
    tlsServername: string;
    identification: Record<string, string>;
    connTimeoutMs: number;
    authTimeoutMs: number;
    socketTimeoutMs: number;
    keepaliveIntervalMs: number;
    idleIntervalMs: number;
    forceNoop: boolean;
    connectDelayMinMs: number;
    connectDelayMaxMs: number;
    postHandshakeDelayMinMs: number;
    postHandshakeDelayMaxMs: number;
    postOpenBoxDelayMinMs: number;
    postOpenBoxDelayMaxMs: number;
    postSearchDelayMinMs: number;
    postSearchDelayMaxMs: number;
    postFetchDelayMinMs: number;
    postFetchDelayMaxMs: number;
}

interface ImapIdCapableConnection extends Imap {
    id?: (
        identification: Record<string, string> | null,
        callback: (error: Error | null, serverIdentity?: unknown) => void
    ) => void;
}

const CLIENT_FAMILY_CONFIG: Record<ClientFamily, {
    deviceClass: DeviceClass;
    devicePrefixes: string[];
    ehloNodePrefixes: string[];
    ehloBaseDomains: string[];
    handshakeProfiles: Array<{ min: number; max: number }>;
    postSendProfiles: Array<{ min: number; max: number }>;
}> = {
    outlook_win: {
        deviceClass: 'desktop',
        devicePrefixes: ['DESKTOP', 'OFFICE-PC', 'WORKSTATION', 'WINPC'],
        ehloNodePrefixes: ['client', 'office', 'corp', 'edge'],
        ehloBaseDomains: ['node1.mailinfra.net', 'node2.mailinfra.net', 'edge1.mailinfra.net', 'edge2.mailinfra.net'],
        handshakeProfiles: [{ min: 18000, max: 36000 }, { min: 24000, max: 48000 }, { min: 32000, max: 60000 }],
        postSendProfiles: [{ min: 3000, max: 7000 }, { min: 5000, max: 10000 }, { min: 7000, max: 16000 }],
    },
    outlook_mac: {
        deviceClass: 'mac',
        devicePrefixes: ['MBP', 'IMAC', 'MACBOOK'],
        ehloNodePrefixes: ['client', 'mbx', 'relay', 'edge'],
        ehloBaseDomains: ['outbound1.mxpool.net', 'outbound2.mxpool.net', 'relay1.clientnet.net', 'relay2.clientnet.net'],
        handshakeProfiles: [{ min: 18000, max: 34000 }, { min: 24000, max: 42000 }, { min: 30000, max: 54000 }],
        postSendProfiles: [{ min: 2500, max: 6000 }, { min: 4000, max: 8000 }, { min: 6000, max: 12000 }],
    },
    thunderbird_win: {
        deviceClass: 'desktop',
        devicePrefixes: ['THUNDER', 'TB-WIN', 'DESKTOP', 'WINPC'],
        ehloNodePrefixes: ['mailhost', 'relay', 'client', 'mxpool'],
        ehloBaseDomains: ['relay1.clientnet.net', 'relay2.clientnet.net', 'node1.mailinfra.net', 'node2.mailinfra.net'],
        handshakeProfiles: [{ min: 15000, max: 30000 }, { min: 22000, max: 42000 }, { min: 28000, max: 52000 }],
        postSendProfiles: [{ min: 2000, max: 5000 }, { min: 3500, max: 7000 }, { min: 5000, max: 11000 }],
    },
    thunderbird_linux: {
        deviceClass: 'laptop',
        devicePrefixes: ['THINKPAD', 'NOTEBOOK', 'ELITEBOOK', 'LAPTOP'],
        ehloNodePrefixes: ['relay', 'mailhost', 'edge', 'mxpool'],
        ehloBaseDomains: ['relay1.clientnet.net', 'relay2.clientnet.net', 'outbound1.mxpool.net', 'outbound2.mxpool.net'],
        handshakeProfiles: [{ min: 16000, max: 28000 }, { min: 22000, max: 38000 }, { min: 28000, max: 50000 }],
        postSendProfiles: [{ min: 2500, max: 5500 }, { min: 4000, max: 8500 }, { min: 6000, max: 13000 }],
    },
    apple_mail: {
        deviceClass: 'mac',
        devicePrefixes: ['MBP', 'MACBOOK', 'IMAC'],
        ehloNodePrefixes: ['mail', 'client', 'relay', 'mbx'],
        ehloBaseDomains: ['outbound1.mxpool.net', 'outbound2.mxpool.net', 'edge1.mailinfra.net', 'edge2.mailinfra.net'],
        handshakeProfiles: [{ min: 14000, max: 26000 }, { min: 20000, max: 34000 }, { min: 26000, max: 44000 }],
        postSendProfiles: [{ min: 2000, max: 4500 }, { min: 3000, max: 6500 }, { min: 4500, max: 9000 }],
    },
};

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

function getStableHashForEmail(email: string): string {
    return createHash('sha256')
        .update(email.toLowerCase().trim())
        .digest('hex');
}

function pickStableValue<T>(hash: string, start: number, values: T[]): T {
    const index = parseInt(hash.slice(start, start + 4), 16) % values.length;
    return values[index];
}

function normalizeEhloLabel(value: string): string {
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || 'agent';
}

function normalizeEhloBaseDomain(value: string): string {
    const normalized = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9.-]/g, '-')
        .replace(/\.+/g, '.')
        .replace(/^-|-$/g, '')
        .replace(/^\.+|\.+$/g, '');

    return normalized || 'localhost.localdomain';
}

function buildDeviceName(hash: string, prefixes: string[]): string {
    const prefix = pickStableValue(hash, 0, prefixes);
    const suffix = hash.slice(0, 6).toUpperCase();
    return `${prefix}-${suffix}`;
}

function getHeadersForClientFamily(clientFamily: ClientFamily, email: string, hash: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (clientFamily === 'outlook_win') {
        headers['X-Mailer'] = pickStableValue(hash, 4, [
            'Microsoft Outlook 16.0',
            'Microsoft Outlook 2019',
            'Microsoft Outlook 16.0.14326.20404',
        ]);
        if (parseInt(hash.slice(20, 22), 16) % 3 === 0) {
            headers['Importance'] = 'normal';
        }
    } else if (clientFamily === 'outlook_mac') {
        headers['X-Mailer'] = pickStableValue(hash, 4, [
            'Microsoft Outlook 16.0',
            'Microsoft Outlook for Mac 16.78',
            'Microsoft Outlook for Mac 16.80',
        ]);
    } else if (clientFamily === 'thunderbird_win' || clientFamily === 'thunderbird_linux') {
        headers['X-Mailer'] = pickStableValue(hash, 4, [
            'Mozilla Thunderbird 102.0',
            'Thunderbird 102.3.0',
            'Mozilla Thunderbird 91.0',
        ]);
        if (parseInt(hash.slice(22, 24), 16) % 4 === 0) {
            headers['X-Priority'] = '3';
        }
    } else {
        headers['X-Mailer'] = pickStableValue(hash, 4, [
            'Apple Mail (16.0)',
            'Apple Mail (15.0)',
            'Apple Mail (2.3654.60.1)',
        ]);
    }

    if (!headers['X-Mailer']) {
        headers['X-Mailer'] = getXMailerForEmail(email);
    }

    return headers;
}

function getClientIdentityForFamily(clientFamily: ClientFamily, hash: string): {
    name: string;
    version: string;
    vendor: string;
    os: string;
    osVersion: string;
    supportUrl: string;
} {
    if (clientFamily === 'outlook_win') {
        return {
            name: 'Microsoft Outlook',
            version: pickStableValue(hash, 40, ['16.0', '2019', '16.0.14326.20404']),
            vendor: 'Microsoft',
            os: 'Windows',
            osVersion: pickStableValue(hash, 42, ['10', '11']),
            supportUrl: 'https://support.microsoft.com/outlook'
        };
    }

    if (clientFamily === 'outlook_mac') {
        return {
            name: 'Microsoft Outlook',
            version: pickStableValue(hash, 40, ['16.78', '16.80', '16.84']),
            vendor: 'Microsoft',
            os: 'macOS',
            osVersion: pickStableValue(hash, 42, ['13.6', '14.4', '14.6']),
            supportUrl: 'https://support.microsoft.com/outlook-for-mac'
        };
    }

    if (clientFamily === 'thunderbird_win') {
        return {
            name: 'Thunderbird',
            version: pickStableValue(hash, 40, ['102.15.1', '115.10.1', '128.0']),
            vendor: 'Mozilla',
            os: 'Windows',
            osVersion: pickStableValue(hash, 42, ['10', '11']),
            supportUrl: 'https://support.mozilla.org/products/thunderbird'
        };
    }

    if (clientFamily === 'thunderbird_linux') {
        return {
            name: 'Thunderbird',
            version: pickStableValue(hash, 40, ['102.15.1', '115.10.1', '128.0']),
            vendor: 'Mozilla',
            os: 'Linux',
            osVersion: pickStableValue(hash, 42, ['6.1', '6.5', '6.8']),
            supportUrl: 'https://support.mozilla.org/products/thunderbird'
        };
    }

    return {
        name: 'Apple Mail',
        version: pickStableValue(hash, 40, ['16.0', '16.1', '17.0']),
        vendor: 'Apple',
        os: 'macOS',
        osVersion: pickStableValue(hash, 42, ['13.6', '14.4', '14.6']),
        supportUrl: 'https://support.apple.com/mail'
    };
}

function buildImapIdentification(clientProfile: ClientProfile, hash: string): Record<string, string> {
    const identity = getClientIdentityForFamily(clientProfile.clientFamily, hash);

    return {
        name: identity.name,
        version: identity.version,
        vendor: identity.vendor,
        os: identity.os,
        'os-version': identity.osVersion,
        device: clientProfile.deviceName,
        'support-url': identity.supportUrl
    };
}

function getClientProfileForSmtpEmail(email: string): ClientProfile {
    const hash = getStableHashForEmail(email);
    const clientFamily = pickStableValue<ClientFamily>(hash, 8, [
        'outlook_win',
        'outlook_win',
        'outlook_mac',
        'thunderbird_win',
        'thunderbird_linux',
        'apple_mail',
    ]);
    const familyConfig = CLIENT_FAMILY_CONFIG[clientFamily];
    const deviceName = buildDeviceName(hash, familyConfig.devicePrefixes);
    const ehloNode = pickStableValue(hash, 16, familyConfig.ehloNodePrefixes);
    const baseDomain = pickStableValue(hash, 24, familyConfig.ehloBaseDomains);
    const ehloName = `${normalizeEhloLabel(deviceName.toLowerCase())}.${normalizeEhloLabel(ehloNode)}.${normalizeEhloBaseDomain(baseDomain)}`;

    const handshakeVariant = parseInt(hash.slice(28, 30), 16) % familyConfig.handshakeProfiles.length;
    const sendVariant = parseInt(hash.slice(30, 32), 16) % familyConfig.postSendProfiles.length;

    return {
        clientFamily,
        deviceClass: familyConfig.deviceClass,
        deviceName,
        ehloNode,
        ehloName,
        headers: getHeadersForClientFamily(clientFamily, email, hash),
        postHandshakeDelayMinMs: familyConfig.handshakeProfiles[handshakeVariant].min,
        postHandshakeDelayMaxMs: familyConfig.handshakeProfiles[handshakeVariant].max,
        postSendDelayMinMs: familyConfig.postSendProfiles[sendVariant].min,
        postSendDelayMaxMs: familyConfig.postSendProfiles[sendVariant].max,
    };
}

function getImapClientProfile(email: string, host: string, clientProfile?: ClientProfile): ImapClientProfile {
    const hash = getStableHashForEmail(email);
    const stableClientProfile = clientProfile || getClientProfileForSmtpEmail(email);
    const localBaseDomain = pickStableValue(hash, 32, EHLO_BASE_DOMAINS);

    return {
        clientFamily: stableClientProfile.clientFamily,
        deviceClass: stableClientProfile.deviceClass,
        deviceName: stableClientProfile.deviceName,
        localHostName: `${normalizeEhloLabel(stableClientProfile.deviceName.toLowerCase())}.${normalizeEhloLabel(stableClientProfile.ehloNode)}.${normalizeEhloBaseDomain(localBaseDomain)}`,
        tlsServername: host,
        identification: buildImapIdentification(stableClientProfile, hash),
        connTimeoutMs: pickStableValue(hash, 34, [48000, 72000, 96000]),
        authTimeoutMs: pickStableValue(hash, 36, [32000, 48000, 64000]),
        socketTimeoutMs: pickStableValue(hash, 38, [120000, 180000, 240000]),
        keepaliveIntervalMs: pickStableValue(hash, 44, [12000, 15000, 20000]),
        idleIntervalMs: pickStableValue(hash, 46, [180000, 240000, 300000]),
        forceNoop: parseInt(hash.slice(48, 50), 16) % 3 === 0,
        connectDelayMinMs: pickStableValue(hash, 50, [1500, 2500, 4000]),
        connectDelayMaxMs: pickStableValue(hash, 52, [5000, 7000, 9000]),
        postHandshakeDelayMinMs: pickStableValue(hash, 54, [3000, 5000, 7000]),
        postHandshakeDelayMaxMs: pickStableValue(hash, 56, [9000, 12000, 15000]),
        postOpenBoxDelayMinMs: pickStableValue(hash, 58, [1200, 1800, 2500]),
        postOpenBoxDelayMaxMs: pickStableValue(hash, 60, [3500, 4500, 6000]),
        postSearchDelayMinMs: pickStableValue(hash, 4, [1000, 1500, 2000]),
        postSearchDelayMaxMs: pickStableValue(hash, 6, [3000, 4000, 5500]),
        postFetchDelayMinMs: pickStableValue(hash, 10, [800, 1200, 1800]),
        postFetchDelayMaxMs: pickStableValue(hash, 12, [2200, 3000, 4200]),
    };
}

// Configuration from environment
const MASTER_URL = process.env.MASTER_URL || 'http://localhost:3000';
const AGENT_SECRET = process.env.AGENT_SECRET || 'change-me-in-production';
const AGENT_NICKNAME = process.env.AGENT_NICKNAME || `agent-${Date.now()}`;

// Initialize logger
logger.init();

// --- Pending Results Persistence ---
// Saves SMTP send results to disk so they survive process crashes.
// On startup, any pending results are re-reported to the master.
const PENDING_RESULTS_DIR = path.join(logger.getLogsDir(), 'pending-results');

function ensurePendingResultsDir(): void {
    if (!fs.existsSync(PENDING_RESULTS_DIR)) {
        fs.mkdirSync(PENDING_RESULTS_DIR, { recursive: true });
    }
}

function savePendingResult(result: { queueId: number; [key: string]: any }): string {
    ensurePendingResultsDir();
    const filename = `result-${result.queueId}-${Date.now()}.json`;
    const filepath = path.join(PENDING_RESULTS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(result), 'utf-8');
    logger.info(`[PendingResults] Saved pending result for queue ${result.queueId} to ${filename}`);
    return filepath;
}

function removePendingResult(filepath: string): void {
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    } catch (error) {
        logger.warn(`[PendingResults] Failed to remove ${filepath}:`, error);
    }
}

function loadPendingResults(): { filepath: string; result: any }[] {
    ensurePendingResultsDir();
    const files = fs.readdirSync(PENDING_RESULTS_DIR).filter(f => f.endsWith('.json'));
    const pending: { filepath: string; result: any }[] = [];
    for (const file of files) {
        const filepath = path.join(PENDING_RESULTS_DIR, file);
        try {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            pending.push({ filepath, result: data });
        } catch (error) {
            logger.warn(`[PendingResults] Failed to parse ${file}, removing:`, error);
            removePendingResult(filepath);
        }
    }
    return pending;
}

const PENDING_RESULTS_MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72 hours

async function retryPendingResults(): Promise<void> {
    const pending = loadPendingResults();
    if (pending.length === 0) return;

    logger.info(`[PendingResults] Found ${pending.length} pending result(s) from previous run, retrying reports...`);

    for (const { filepath, result } of pending) {
        // Clean up stale files — after 72h the master has already timed out these items
        try {
            const stat = fs.statSync(filepath);
            if (Date.now() - stat.mtimeMs > PENDING_RESULTS_MAX_AGE_MS) {
                logger.info(`[PendingResults] Removing expired result for queue ${result.queueId} (older than 72h)`);
                removePendingResult(filepath);
                continue;
            }
        } catch {
            // stat failed, file may have been removed concurrently
            continue;
        }

        try {
            const reportSuccess = await report([result]);
            if (reportSuccess) {
                logger.info(`[PendingResults] Successfully reported queue ${result.queueId} from previous run`);
                removePendingResult(filepath);
            } else {
                logger.warn(`[PendingResults] Failed to report queue ${result.queueId}, will retry next startup`);
            }
        } catch (error) {
            logger.warn(`[PendingResults] Error reporting queue ${result.queueId}:`, error);
        }
    }
}

// --- Global Error Handlers ---
// Prevent uncaught exceptions and unhandled rejections from silently crashing the process.
process.on('uncaughtException', (error: Error) => {
    logger.error('[FATAL] Uncaught exception - process will continue but may be unstable:', error);
    logger.error(`[FATAL] Stack: ${error.stack || 'no stack'}`);
    // Don't exit - let the process continue so pending reports can still be sent.
    // The process manager (systemd/docker) will restart if things go truly wrong.
});

process.on('unhandledRejection', (reason: any) => {
    logger.error('[FATAL] Unhandled promise rejection:', reason);
    if (reason instanceof Error) {
        logger.error(`[FATAL] Stack: ${reason.stack || 'no stack'}`);
    }
    // Don't exit - same rationale as uncaughtException.
});

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
let smtpTestQueue: SmtpTestTask[] = [];
let isPollingEnabled = true;
let isShuttingDown = false;
let isProcessing = false; // Track if currently processing tasks
let isProcessingSmtpTests = false;
let isSendingEmail = false;

/**
 * Get current queue size
 */
function getQueueSize(): number {
    return currentQueue.length + smtpTestQueue.length;
}

/**
 * Stop polling for new tasks
 */
function stopPolling(): void {
    isPollingEnabled = false;
    log('[Agent] Polling stopped - no new campaign or SMTP test tasks will be fetched');
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
    if (currentQueue.length > 0 || smtpTestQueue.length > 0 || isProcessing || isProcessingSmtpTests || isSendingEmail) {
        log(`[Agent] Waiting for work to complete...`);
        log(`[Agent] Campaign queue: ${currentQueue.length}, SMTP test queue: ${smtpTestQueue.length}, Processing campaigns: ${isProcessing}, Processing SMTP tests: ${isProcessingSmtpTests}, Sending: ${isSendingEmail}`);

        while (currentQueue.length > 0 || smtpTestQueue.length > 0 || isProcessing || isProcessingSmtpTests || isSendingEmail) {
            await sleep(1000);
            if (currentQueue.length > 0 || smtpTestQueue.length > 0 || isProcessing || isProcessingSmtpTests || isSendingEmail) {
                log(`[Agent] Campaign queue: ${currentQueue.length}, SMTP test queue: ${smtpTestQueue.length}, Processing campaigns: ${isProcessing}, Processing SMTP tests: ${isProcessingSmtpTests}, Sending: ${isSendingEmail}`);
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
    campaignId: number | null;
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
    } | null;
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
    smtpResponse?: string;
    trackingId?: string;
    subject?: string;
    body?: string;
    errorMessage?: string;
}

interface SmtpTestTask {
    recipientId: number;
    runId: number;
    subject: string;
    body: string;
    recipientEmail: string;
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

interface SmtpTestTaskResult {
    recipientId: number;
    runId: number;
    smtpId: number;
    smtpEmail: string;
    success: boolean;
    smtpResponse?: string;
    errorMessage?: string;
    sentAt?: string;
}

interface ImapTask {
    accountId: number;
    email: string;
    delaySeconds: number;
    imapConfig: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
    };
}

interface ImapTaskResult {
    accountId: number;
    email: string;
    success: boolean;
    emails: ReceivedEmail[];
    errorMessage?: string;
}

interface ReceivedEmail {
    messageId: string;
    from: { email: string; name?: string };
    to: string;
    subject: string;
    textBody?: string;
    htmlBody?: string;
    receivedAt: string;
}

// Helper: Sleep
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelayMs(minMs: number, maxMs: number): number {
    const normalizedMin = Math.min(minMs, maxMs);
    const normalizedMax = Math.max(minMs, maxMs);
    return Math.round(Math.random() * (normalizedMax - normalizedMin)) + normalizedMin;
}

// Helper: Random delay to simulate human behavior
function randomDelay(minMs: number, maxMs: number): Promise<void> {
    return sleep(getRandomDelayMs(minMs, maxMs));
}

function getDurationMs(startTime: number): number {
    return Date.now() - startTime;
}

async function runExclusiveEmailSend<T>(label: string, work: () => Promise<T>): Promise<T> {
    while (isSendingEmail) {
        logger.info(`[Agent] Waiting for active email send lock before ${label}...`);
        await sleep(500);
    }

    isSendingEmail = true;
    try {
        return await work();
    } finally {
        isSendingEmail = false;
    }
}

async function verifySmtpConnection(
    transporter: nodemailer.Transporter,
    context: {
        queueId: number;
        campaignId: number | null;
        smtpEmail: string;
        smtpHost: string;
        smtpPort: number;
        authType: string;
    }
): Promise<number> {
    const verifyStart = Date.now();
    await transporter.verify();
    const handshakeMs = getDurationMs(verifyStart);

    logger.info('[Agent] SMTP handshake verified:', {
        queueId: context.queueId,
        campaignId: context.campaignId,
        smtpEmail: context.smtpEmail,
        smtpHost: context.smtpHost,
        smtpPort: context.smtpPort,
        authType: context.authType,
        handshakeMs
    });

    return handshakeMs;
}

async function sendImapIdentification(
    imap: Imap,
    imapProfile: ImapClientProfile,
    context: { accountId: number; email: string; host: string }
): Promise<void> {
    const idCapableImap = imap as ImapIdCapableConnection;

    if (!idCapableImap.id || !imap.serverSupports('ID')) {
        logger.info('[IMAP] Server does not advertise IMAP ID capability, skipping client identification:', {
            accountId: context.accountId,
            email: context.email,
            host: context.host
        });
        return;
    }

    await new Promise<void>((resolve) => {
        idCapableImap.id?.(imapProfile.identification, (error, serverIdentity) => {
            if (error) {
                logger.warn('[IMAP] Failed to send client identification:', {
                    accountId: context.accountId,
                    email: context.email,
                    host: context.host,
                    error: error.message
                });
                return resolve();
            }

            logger.info('[IMAP] Sent stable IMAP client identification:', {
                accountId: context.accountId,
                email: context.email,
                host: context.host,
                identification: imapProfile.identification,
                serverIdentity
            });
            resolve();
        });
    });
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

// Poll for SMTP test tasks
async function pollSmtpTests(): Promise<SmtpTestTask[]> {
    if (!agentToken) {
        console.error('[Agent] Not registered, cannot poll SMTP test tasks');
        return [];
    }

    try {
        const baseUrl = MASTER_URL.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/agents/poll-smtp-tests`, {
            method: 'GET',
            headers: {
                'X-Agent-Token': agentToken,
                'X-Agent-Version': VERSION,
                'X-Custom-Agent': 'RankScaleAIEmailAgent'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`[Agent] SMTP test poll failed: ${error.error}`);

            if (response.status === 401) {
                agentToken = null;
            }
            return [];
        }

        const data = await response.json();
        if (data.config) {
            config = { ...config, ...data.config };
        }

        return data.tasks || [];
    } catch (error) {
        console.error('[Agent] SMTP test poll error:', error);
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

async function reportSmtpTests(results: SmtpTestTaskResult[]): Promise<boolean> {
    if (!agentToken || results.length === 0) return true;

    const MAX_RETRIES = 5;
    const RETRY_DELAY = 30000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.info(`[Agent] Reporting ${results.length} SMTP test result(s) to master (attempt ${attempt}/${MAX_RETRIES})`);

            const baseUrl = MASTER_URL.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/api/agents/report-smtp-tests`, {
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
                logger.error(`[Agent] SMTP test report failed (attempt ${attempt}/${MAX_RETRIES}): ${error.error}`);

                if (attempt < MAX_RETRIES) {
                    logger.warn(`[Agent] Retrying SMTP test report in ${RETRY_DELAY / 1000} seconds...`);
                    await sleep(RETRY_DELAY);
                    continue;
                }

                logger.error('[Agent] SMTP test report failed after maximum retries. Results will be lost.');
                return false;
            }

            logger.info(`[Agent] Successfully reported ${results.length} SMTP test result(s) to master`);
            return true;
        } catch (error) {
            logger.error(`[Agent] SMTP test report error (attempt ${attempt}/${MAX_RETRIES}):`, error);

            if (attempt < MAX_RETRIES) {
                logger.warn(`[Agent] Retrying SMTP test report in ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
                continue;
            }

            logger.error('[Agent] SMTP test report failed after maximum retries due to network error.');
            return false;
        }
    }

    return false;
}

// Report IMAP results to master with retry mechanism
async function reportImap(results: ImapTaskResult[]): Promise<boolean> {
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
    const sendStart = Date.now();

    try {
        // Use pre-generated content from master
        if (!subject || !body) {
            throw new Error('Missing pre-generated email content');
        }

        // Log detailed email information for debugging
        logger.info(`[Agent] Preparing email:`, {
            queueId,
            campaignId: task.campaignId,
            to: contact.email,
            from: smtp.email,
            subjectLength: subject.length,
            bodyLength: body.length,
            hasTrackingId: !!trackingId,
            replyTo: campaign?.replyTo || smtp.email,
            smtpHost: smtp.host || 'smtp.gmail.com',
            smtpPort: smtp.port || 587
        });

        const isSecure = smtp.secure === true;
        const authType = smtp.authType || 'basic';
        const smtpHost = smtp.host || (authType === 'oauth2' ? 'smtp.office365.com' : 'smtp.gmail.com');
        const smtpPort = smtp.port || 587;
        const clientProfile = getClientProfileForSmtpEmail(smtp.email);
        const ehloName = clientProfile.ehloName;
        const stableHeaders = clientProfile.headers;

        logger.info('[Agent] SMTP client profile selected:', {
            queueId,
            campaignId: task.campaignId,
            smtpEmail: smtp.email,
            clientFamily: clientProfile.clientFamily,
            deviceClass: clientProfile.deviceClass,
            deviceName: clientProfile.deviceName,
            ehloNode: clientProfile.ehloNode,
            ehloName,
            headers: stableHeaders
        });

        // Detect AOL SMTP - AOL has strict Reply-To validation
        const isAOL = smtp.host?.includes('aol.com') || smtp.email?.includes('@aol.com');

        // For AOL SMTP, force Reply-To to sender's email to avoid 550 errors
        // AOL rejects emails when Reply-To = recipient address (anti-phishing)
        let finalReplyTo: string;
        if (isAOL) {
            finalReplyTo = smtp.email;
            if (campaign?.replyTo && campaign.replyTo !== smtp.email) {
                logger.warn(`[Agent] AOL SMTP detected - overriding Reply-To from "${campaign.replyTo}" to "${smtp.email}" to avoid rejection`);
            }
        } else {
            finalReplyTo = campaign?.replyTo || smtp.email;
        }

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
                host: smtpHost,
                port: smtpPort,
                secure: isSecure,
                name: ehloName,
                auth: {
                    type: 'OAuth2',
                    user: smtp.email,
                    accessToken: accessToken
                }
            };

            const transporter = nodemailer.createTransport(transportConfig as nodemailer.TransportOptions);

            const handshakeMs = await verifySmtpConnection(transporter, {
                queueId,
                campaignId: task.campaignId,
                smtpEmail: smtp.email,
                smtpHost,
                smtpPort,
                authType
            });

            // After successful SMTP login/identification, wait before sending to mimic human behavior
            const postLoginDelayMs = Math.round(
                Math.random() * (clientProfile.postHandshakeDelayMaxMs - clientProfile.postHandshakeDelayMinMs)
            ) + clientProfile.postHandshakeDelayMinMs;
            logger.info('[Agent] Waiting after SMTP handshake before send:', {
                queueId,
                campaignId: task.campaignId,
                smtpEmail: smtp.email,
                postLoginDelayMs,
                clientFamily: clientProfile.clientFamily,
                deviceName: clientProfile.deviceName
            });
            await sleep(postLoginDelayMs);

            // Send email
            const mailSendStart = Date.now();

            const sendResult = await transporter.sendMail({
                from: smtp.email,
                to: contact.email,
                subject,
                html: body,
                replyTo: finalReplyTo,
                headers: stableHeaders
            });
            const sendMailMs = getDurationMs(mailSendStart);
            const totalMs = getDurationMs(sendStart);

            // Log SMTP response details
            logger.info(`[Agent] SMTP accepted email (OAuth2):`, {
                queueId,
                campaignId: task.campaignId,
                to: contact.email,
                from: smtp.email,
                replyTo: finalReplyTo,
                ehloNode: clientProfile.ehloNode,
                ehloName,
                clientFamily: clientProfile.clientFamily,
                deviceName: clientProfile.deviceName,
                headers: stableHeaders,
                isAOL,
                messageId: sendResult.messageId,
                response: sendResult.response,
                accepted: sendResult.accepted,
                rejected: sendResult.rejected,
                handshakeMs,
                sendMailMs,
                totalMs
            });

            // Post-send delay
            await randomDelay(clientProfile.postSendDelayMinMs, clientProfile.postSendDelayMaxMs);

            log(`[Agent] Sent email to ${contact.email} via ${smtp.email} (OAuth2)`);

            return {
                queueId,
                smtpId: smtp.id,
                smtpEmail: smtp.email,
                success: true,
                smtpResponse: sendResult.response,
                trackingId,
                subject,
                body
            };
        } else {
            // Basic password authentication
            log(`[Agent] Using basic authentication for ${smtp.email}`);

            const transportConfig = {
                host: smtpHost,
                port: smtpPort,
                secure: isSecure,
                requireTLS: !isSecure,
                name: ehloName,
                auth: {
                    user: smtp.email,
                    pass: smtp.password
                },
                tls: {
                    rejectUnauthorized: isSecure
                }
            };

            const transporter = nodemailer.createTransport(transportConfig as nodemailer.TransportOptions);

            const handshakeMs = await verifySmtpConnection(transporter, {
                queueId,
                campaignId: task.campaignId,
                smtpEmail: smtp.email,
                smtpHost,
                smtpPort,
                authType
            });

            // After successful SMTP login/identification, wait before sending to mimic human behavior
            const postLoginDelayMs = Math.round(
                Math.random() * (clientProfile.postHandshakeDelayMaxMs - clientProfile.postHandshakeDelayMinMs)
            ) + clientProfile.postHandshakeDelayMinMs;
            logger.info('[Agent] Waiting after SMTP handshake before send:', {
                queueId,
                campaignId: task.campaignId,
                smtpEmail: smtp.email,
                postLoginDelayMs,
                clientFamily: clientProfile.clientFamily,
                deviceName: clientProfile.deviceName
            });
            await sleep(postLoginDelayMs);

            // Send email
            const mailSendStart = Date.now();

            const sendResult = await transporter.sendMail({
                from: smtp.email,
                to: contact.email,
                subject,
                html: body,
                replyTo: finalReplyTo,
                headers: stableHeaders
            });
            const sendMailMs = getDurationMs(mailSendStart);
            const totalMs = getDurationMs(sendStart);

            // Log SMTP response details
            logger.info(`[Agent] SMTP accepted email (Basic Auth):`, {
                queueId,
                campaignId: task.campaignId,
                to: contact.email,
                from: smtp.email,
                replyTo: finalReplyTo,
                ehloNode: clientProfile.ehloNode,
                ehloName,
                clientFamily: clientProfile.clientFamily,
                deviceName: clientProfile.deviceName,
                headers: stableHeaders,
                isAOL,
                messageId: sendResult.messageId,
                response: sendResult.response,
                accepted: sendResult.accepted,
                rejected: sendResult.rejected,
                pending: sendResult.pending,
                handshakeMs,
                sendMailMs,
                totalMs
            });

            // Post-send delay
            await randomDelay(clientProfile.postSendDelayMinMs, clientProfile.postSendDelayMaxMs);

            log(`[Agent] Sent email to ${contact.email} via ${smtp.email} (Basic Auth)`);

            return {
                queueId,
                smtpId: smtp.id,
                smtpEmail: smtp.email,
                success: true,
                smtpResponse: sendResult.response,
                trackingId,
                subject,
                body
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Log detailed error information
        logger.error(`[Agent] Failed to send email:`, {
            queueId,
            campaignId: task.campaignId,
            to: contact.email,
            from: smtp.email,
            error: errorMessage,
            totalMs: getDurationMs(sendStart),
            errorStack: error instanceof Error ? error.stack : undefined
        });

        return {
            queueId,
            smtpId: smtp.id,
            smtpEmail: smtp.email,
            success: false,
            errorMessage
        };
    }
}

async function sendSmtpTestEmail(task: SmtpTestTask): Promise<SmtpTestTaskResult> {
    const syntheticTask = {
        queueId: task.recipientId,
        campaignId: null,
        subject: task.subject,
        body: task.body,
        trackingId: `smtp-test-run-${task.runId}-recipient-${task.recipientId}`,
        contact: {
            id: task.recipientId,
            email: task.recipientEmail
        },
        campaign: null,
        smtp: task.smtp
    } as Task;

    const result = await sendEmail(syntheticTask);

    return {
        recipientId: task.recipientId,
        runId: task.runId,
        smtpId: result.smtpId,
        smtpEmail: result.smtpEmail,
        success: result.success,
        smtpResponse: result.smtpResponse,
        errorMessage: result.errorMessage,
        sentAt: result.success ? new Date().toISOString() : undefined
    };
}

function isImapTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes('timed out') || msg.includes('timeout') || msg.includes('etimedout');
    }
    return false;
}

// Single IMAP connection attempt with configurable timeout multiplier
// IMAP receive is a background task — no human-like delays needed (unlike SMTP send).
async function checkImapOnce(
    task: ImapTask,
    imapProfile: ImapClientProfile,
    timeoutMultiplier: number
): Promise<ReceivedEmail[]> {
    const { accountId, email, imapConfig } = task;

    return new Promise<ReceivedEmail[]>((resolve, reject) => {
        const connectStart = Date.now();
        const connTimeout = Math.round(imapProfile.connTimeoutMs * timeoutMultiplier);
        const authTimeout = Math.round(imapProfile.authTimeoutMs * timeoutMultiplier);
        const socketTimeout = Math.round(imapProfile.socketTimeoutMs * timeoutMultiplier);

        logger.info(`[IMAP] Connecting to ${imapConfig.host}:${imapConfig.port}`, {
            accountId, email,
            connTimeout, authTimeout, socketTimeout,
            timeoutMultiplier,
            tls: imapConfig.secure,
            servername: imapProfile.tlsServername
        });

        const imapConnectionConfig: any = {
            user: imapConfig.user,
            password: imapConfig.password,
            host: imapConfig.host,
            port: imapConfig.port,
            tls: imapConfig.secure,
            autotls: imapConfig.secure ? 'never' : 'required',
            tlsOptions: {
                servername: imapProfile.tlsServername,
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            },
            connTimeout,
            authTimeout,
            socketTimeout,
        };
        const imap = new Imap(imapConnectionConfig);

        const fetchedEmails: ReceivedEmail[] = [];
        let processedCount = 0;
        let totalMessages = 0;
        let settled = false;

        const resolveOnce = (value: ReceivedEmail[]) => {
            if (settled) return;
            settled = true;
            clearTimeout(hardTimer);
            resolve(value);
        };

        const rejectOnce = (error: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(hardTimer);
            reject(error);
        };

        const endConnection = () => {
            try {
                imap.end();
                // Force destroy if end() doesn't close within 5s
                setTimeout(() => {
                    try { imap.destroy(); } catch (_) {}
                }, 5000);
            } catch (error) {
                try { imap.destroy(); } catch (_) {}
                logger.warn('[IMAP] Failed to gracefully end IMAP connection:', {
                    accountId,
                    email,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        };

        // Hard timeout: if the entire operation takes too long, force resolve
        const hardTimeoutMs = connTimeout + 15000; // connTimeout + 15s buffer
        const hardTimer = setTimeout(() => {
            logger.warn(`[IMAP] Hard timeout after ${hardTimeoutMs}ms for ${email}`, { accountId });
            try { imap.destroy(); } catch (_) {}
            rejectOnce(new Error(`IMAP hard timeout after ${hardTimeoutMs}ms`));
        }, hardTimeoutMs);

        imap.once('ready', () => {
            const handshakeMs = getDurationMs(connectStart);
            logger.info('[IMAP] Connected:', { accountId, email, handshakeMs });

            imap.openBox('INBOX', false, (err: any, box: any) => {
                if (err) {
                    endConnection();
                    rejectOnce(err instanceof Error ? err : new Error(String(err)));
                    return;
                }

                logger.info('[IMAP] INBOX opened:', {
                    accountId, email,
                    total: box?.messages?.total,
                    unseen: box?.messages?.unseen
                });

                imap.search(['UNSEEN'], (searchError: any, results: number[] | undefined) => {
                    if (searchError) {
                        endConnection();
                        rejectOnce(searchError instanceof Error ? searchError : new Error(String(searchError)));
                        return;
                    }

                    if (!results || results.length === 0) {
                        logger.info(`[IMAP] No new messages for ${email}`);
                        resolveOnce(fetchedEmails);
                        endConnection();
                        return;
                    }

                    totalMessages = results.length;
                    logger.info(`[IMAP] Found ${totalMessages} new messages for ${email}`);

                    const fetch = imap.fetch(results, { bodies: '', markSeen: true });
                    const messageProcessingPromises: Array<Promise<void>> = [];

                    fetch.on('message', (msg: any, seqno: number) => {
                        const messageProcessing = new Promise<void>((resolveMessage) => {
                            let bodyProcessed = false;

                            msg.on('body', (stream: any) => {
                                bodyProcessed = true;

                                const parsePromise = (async () => {
                                    try {
                                        const parsed: any = await simpleParser(stream);
                                        const fromAddress = parsed.from?.value?.[0];
                                        const toAddress = parsed.to?.value?.[0];

                                        const receivedEmail: ReceivedEmail = {
                                            messageId: parsed.messageId || `generated-${Date.now()}-${seqno}`,
                                            from: {
                                                email: fromAddress?.address || 'unknown@unknown.com',
                                                name: fromAddress?.name
                                            },
                                            to: toAddress?.address || '',
                                            subject: parsed.subject || '(No Subject)',
                                            textBody: parsed.text,
                                            htmlBody: parsed.html ? String(parsed.html) : undefined,
                                            receivedAt: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                                        };

                                        fetchedEmails.push(receivedEmail);
                                        logger.info(`[IMAP] Parsed email: ${receivedEmail.subject} from ${receivedEmail.from.email}`);
                                    } catch (error) {
                                        logger.error(`[IMAP] Error processing email ${seqno}:`, error);
                                    } finally {
                                        processedCount++;
                                        resolveMessage();
                                    }
                                })();

                                void parsePromise;
                            });

                            msg.once('end', () => {
                                if (!bodyProcessed) {
                                    processedCount++;
                                    resolveMessage();
                                }
                            });
                        });

                        messageProcessingPromises.push(messageProcessing);
                    });

                    fetch.once('error', (fetchError: any) => {
                        logger.error('[IMAP] Fetch error:', fetchError);
                        fetch.removeAllListeners();
                        endConnection();
                        rejectOnce(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
                    });

                    fetch.once('end', () => {
                        void (async () => {
                            await Promise.allSettled(messageProcessingPromises);
                            logger.info(`[IMAP] Fetch completed. Processed ${processedCount}/${totalMessages} messages`);
                            fetch.removeAllListeners();
                            resolveOnce(fetchedEmails);
                            endConnection();
                        })().catch((fetchEndError) => {
                            resolveOnce(fetchedEmails);
                            endConnection();
                            rejectOnce(
                                fetchEndError instanceof Error
                                    ? fetchEndError
                                    : new Error(String(fetchEndError))
                            );
                        });
                    });
                });
            });
        });

        imap.once('error', (err: any) => {
            logger.error('[IMAP] Connection error:', err);
            rejectOnce(err instanceof Error ? err : new Error(String(err)));
        });

        imap.once('end', () => {
            logger.info(`[IMAP] Connection ended for ${email}`);
            resolveOnce(fetchedEmails);
        });

        imap.connect();
    });
}

// Check IMAP for new emails - agent directly connects to IMAP server
// Retries up to 3 times on timeout errors, doubling the timeout each attempt.
const IMAP_MAX_RETRIES = 3;

async function checkImap(task: ImapTask): Promise<ImapTaskResult> {
    const { accountId, email, imapConfig } = task;
    const checkStart = Date.now();
    const smtpLikeClientProfile = getClientProfileForSmtpEmail(email);
    const imapProfile = getImapClientProfile(email, imapConfig.host, smtpLikeClientProfile);

    logger.info(`[IMAP] Starting check for ${email}`, {
        accountId,
        host: imapConfig.host,
        port: imapConfig.port,
        connTimeoutMs: imapProfile.connTimeoutMs,
        authTimeoutMs: imapProfile.authTimeoutMs,
        connectDelayRange: `${imapProfile.connectDelayMinMs}-${imapProfile.connectDelayMaxMs}ms`
    });

    // Wait for the specified delay — only once before first attempt
    if (task.delaySeconds > 0) {
        logger.info(`[IMAP] Pre-check delay: ${task.delaySeconds}s for ${email}`);
        await sleep(task.delaySeconds * 1000);
        logger.info(`[IMAP] Pre-check delay done for ${email} (elapsed: ${Date.now() - checkStart}ms)`);
    }

    // Stable client-specific connection delay — only once before first attempt
    const connectDelay = getRandomDelayMs(
        imapProfile.connectDelayMinMs,
        imapProfile.connectDelayMaxMs
    );
    logger.info(`[IMAP] Connect delay: ${connectDelay}ms for ${email}`);
    await sleep(connectDelay);
    logger.info(`[IMAP] Connect delay done for ${email} (elapsed: ${Date.now() - checkStart}ms)`);

    let lastError: string = '';

    for (let attempt = 1; attempt <= IMAP_MAX_RETRIES; attempt++) {
        const timeoutMultiplier = Math.pow(2, attempt - 1); // 1x, 2x, 4x
        const attemptStart = Date.now();

        try {
            logger.info(`[IMAP] Attempt ${attempt}/${IMAP_MAX_RETRIES} for ${email}`, {
                accountId,
                timeoutMultiplier,
                connTimeoutMs: Math.round(imapProfile.connTimeoutMs * timeoutMultiplier),
                authTimeoutMs: Math.round(imapProfile.authTimeoutMs * timeoutMultiplier),
                totalElapsedMs: Date.now() - checkStart
            });

            const emails = await checkImapOnce(task, imapProfile, timeoutMultiplier);

            logger.info(`[IMAP] Attempt ${attempt} succeeded for ${email}`, {
                accountId,
                emailsFetched: emails.length,
                attemptMs: Date.now() - attemptStart,
                totalMs: Date.now() - checkStart
            });

            return {
                accountId,
                email,
                success: true,
                emails
            };
        } catch (error: any) {
            lastError = error instanceof Error ? error.message : String(error);

            logger.error(`[IMAP] Attempt ${attempt}/${IMAP_MAX_RETRIES} failed for ${email}`, {
                accountId,
                error: lastError,
                isTimeout: isImapTimeoutError(error),
                attemptMs: Date.now() - attemptStart,
                totalMs: Date.now() - checkStart,
                willRetry: isImapTimeoutError(error) && attempt < IMAP_MAX_RETRIES
            });

            if (isImapTimeoutError(error) && attempt < IMAP_MAX_RETRIES) {
                continue;
            }

            return {
                accountId,
                email,
                success: false,
                emails: [],
                errorMessage: lastError
            };
        }
    }

    // Should never reach here
    return {
        accountId,
        email,
        success: false,
        emails: [],
        errorMessage: lastError
    };
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

// IMAP polling loop - runs independently
// IMPORTANT: This loop is fully isolated from the SMTP sending pipeline.
// Any error here (connection hang, crash, timeout) must NEVER propagate
// to the main process or affect email sending/reporting.
async function imapPollingLoop() {
    log('[Agent] IMAP polling loop started');

    while (true) {
        try {
            // Wait for poll interval before checking
            await sleep(config.pollInterval);

            if (!agentToken) {
                continue;
            }

            // Poll for IMAP tasks
            let response: Response;
            try {
                const baseUrl = MASTER_URL.replace(/\/$/, '');
                response = await fetch(`${baseUrl}/api/agents/poll-imap`, {
                    method: 'GET',
                    headers: {
                        'X-Agent-Token': agentToken,
                        'X-Agent-Version': VERSION,
                        'X-Custom-Agent': 'RankScaleAIEmailAgent'
                    }
                });
            } catch (fetchError) {
                logger.warn('[IMAP] Poll fetch error (network issue, will retry next cycle):', fetchError);
                continue;
            }

            if (!response.ok) {
                logger.warn(`[IMAP] Poll failed: ${response.status} ${response.statusText}`);
                continue;
            }

            const data = await response.json();

            if (!data.success || !data.tasks || data.tasks.length === 0) {
                continue;
            }

            logger.info(`[IMAP] Received ${data.tasks.length} IMAP check tasks`);

            // Update config (dynamic rate limiting adjustment)
            if (data.config) {
                config = { ...config, ...data.config };
            }

            // Process tasks and report each result immediately
            // Each task is individually wrapped in try-catch so a single
            // failing IMAP account cannot crash the loop or block other tasks.
            for (const [taskIdx, task] of data.tasks.entries()) {
                try {
                    const taskStart = Date.now();
                    logger.info(`[IMAP] Processing task ${taskIdx + 1}/${data.tasks.length}`, {
                        accountId: task.accountId,
                        email: task.email,
                        host: task.imapConfig?.host,
                        delaySeconds: task.delaySeconds
                    });

                    const result = await checkImap(task);

                    logger.info(`[IMAP] Task completed in ${Date.now() - taskStart}ms`, {
                        accountId: result.accountId,
                        email: result.email,
                        success: result.success,
                        emailCount: result.emails.length,
                        errorMessage: result.errorMessage || null
                    });

                    // Report immediately after each task so results aren't lost on restart
                    logger.info(`[IMAP] Reporting result for ${result.email} (success=${result.success})...`);
                    try {
                        const reportSuccess = await reportImap([result]);
                        if (reportSuccess) {
                            logger.info(`[IMAP] Report accepted for ${result.email}`);
                        } else {
                            logger.warn(`[IMAP] Failed to report result for ${result.email} after all retries`);
                        }
                    } catch (reportError) {
                        logger.error(`[IMAP] Report crashed for ${task.email}:`, reportError);
                    }
                } catch (taskError) {
                    // Individual IMAP task failure - log and continue to next task
                    logger.error(`[IMAP] Task failed for account ${task.accountId} (${task.email}), skipping:`, taskError);
                }

                // Task interval delay (rate limiting)
                if (taskIdx < data.tasks.length - 1) {
                    logger.info(`[IMAP] Waiting ${config.sendInterval}ms before next check (rate limiting)`);
                    await sleep(config.sendInterval);
                }
            }

        } catch (error) {
            // Outer catch: protects against any unexpected error in the loop itself
            logger.error('[IMAP] Polling loop error (will retry in 60s):', error);
            await sleep(60000);
        }
    }
}

async function smtpTestPollingLoop() {
    log('[Agent] SMTP test polling loop started');

    while (true) {
        try {
            if (!isPollingEnabled) {
                if (smtpTestQueue.length > 0) {
                    isProcessingSmtpTests = true;
                    log('[Agent] SMTP test polling is disabled, processing remaining SMTP test queue...');
                    const task = smtpTestQueue.shift()!;
                    const result = await runExclusiveEmailSend(
                        `SMTP test recipient ${task.recipientId}`,
                        () => sendSmtpTestEmail(task)
                    );

                    const reportSuccess = await reportSmtpTests([result]);
                    if (!reportSuccess) {
                        logger.warn('[Agent] Failed to report SMTP test result after retries, but continuing with remaining SMTP test queue');
                    }

                    isProcessingSmtpTests = false;

                    if (smtpTestQueue.length > 0) {
                        await sleep(config.sendInterval);
                    }
                } else if (!isProcessingSmtpTests) {
                    break;
                }

                await sleep(1000);
                continue;
            }

            const tasks = await pollSmtpTests();
            if (tasks.length > 0) {
                isProcessingSmtpTests = true;
                smtpTestQueue.push(...tasks);
                log(`[Agent] Received ${tasks.length} SMTP test task(s)`);

                const results: SmtpTestTaskResult[] = [];
                for (const task of tasks) {
                    const result = await runExclusiveEmailSend(
                        `SMTP test recipient ${task.recipientId}`,
                        () => sendSmtpTestEmail(task)
                    );
                    results.push(result);

                    const index = smtpTestQueue.indexOf(task);
                    if (index > -1) {
                        smtpTestQueue.splice(index, 1);
                    }

                    if (tasks.indexOf(task) < tasks.length - 1) {
                        await sleep(config.sendInterval);
                    }
                }

                const reportSuccess = await reportSmtpTests(results);
                isProcessingSmtpTests = false;

                if (reportSuccess) {
                    log(`[Agent] Completed ${results.length} SMTP test task(s), ${results.filter(r => r.success).length} successful`);
                } else {
                    log(`[Agent] Completed ${results.length} SMTP test task(s), ${results.filter(r => r.success).length} successful, but failed to report to master after retries`);
                }
            }

            await sleep(config.pollInterval);
        } catch (error) {
            logger.error('[Agent] SMTP test polling loop error:', error);
            isProcessingSmtpTests = false;
            await sleep(10000);
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

    // Retry any pending results from previous crash
    await retryPendingResults();

    // Start health check loop in background
    log(`[Agent] Starting health check loop (interval: ${config.healthCheckInterval}ms)...`);
    healthCheckLoop().catch(console.error);

    // Start IMAP polling loop in background
    log(`[Agent] Starting IMAP polling loop (interval: ${config.pollInterval}ms)...`);
    imapPollingLoop().catch(console.error);

    // Start SMTP test polling loop in background
    log(`[Agent] Starting SMTP test polling loop (interval: ${config.pollInterval}ms)...`);
    smtpTestPollingLoop().catch(console.error);

    // Start update checker
    log('[Agent] Starting auto-update checker...');
    updateChecker.config.getQueueSize = getQueueSize;
    updateChecker.config.stopPolling = stopPolling;
    updateChecker.start();

    // Start memory monitoring (every 60 seconds)
    log('[Agent] Starting memory monitor (interval: 60s, limit: 512MB)...');
    const MEMORY_LIMIT_MB = 512;
    const MEMORY_WARNING_THRESHOLD = 0.8; // 80% of limit

    setInterval(() => {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
        const rssMB = Math.round(usage.rss / 1024 / 1024);
        const queueSize = getQueueSize();

        // Log memory stats
        logger.info(`[Memory] Heap: ${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB, Queue: ${queueSize}`);

        // Warning if approaching memory limit
        if (rssMB > MEMORY_LIMIT_MB * MEMORY_WARNING_THRESHOLD) {
            logger.warn(`[Memory] WARNING: Memory usage (${rssMB}MB) approaching limit (${MEMORY_LIMIT_MB}MB)!`);
        }

        // Critical alert if exceeding limit
        if (rssMB > MEMORY_LIMIT_MB) {
            logger.error(`[Memory] CRITICAL: Memory usage (${rssMB}MB) exceeded limit (${MEMORY_LIMIT_MB}MB)!`);
        }
    }, 60000); // Every 60 seconds

    // Main polling loop
    log('[Agent] Starting polling loop...');

    while (true) {
        try {
            log('[Agent] Polling loop iteration starting...');

            // Check if polling is disabled
            if (!isPollingEnabled) {
                // Process remaining queue
                if (currentQueue.length > 0) {
                    isProcessing = true;
                    log('[Agent] Polling is disabled, processing remaining queue...');
                    const task = currentQueue.shift()!;
                    const result = await runExclusiveEmailSend(
                        `campaign queue item ${task.queueId}`,
                        () => sendEmail(task)
                    );

                    // Persist to disk before reporting
                    const pendingFile = savePendingResult(result);

                    // Report with retry mechanism
                    const reportSuccess = await report([result]);
                    if (reportSuccess) {
                        removePendingResult(pendingFile);
                    } else {
                        logger.warn('[Agent] Failed to report result after 5 retries, saved to disk for retry on next startup');
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
            log('[Agent] Calling poll()...');
            const tasks = await poll();
            log(`[Agent] Poll returned ${tasks.length} task(s)`);

            if (tasks.length > 0) {
                isProcessing = true;
                log(`[Agent] Received ${tasks.length} task(s)`);

                // Add to queue
                currentQueue.push(...tasks);
                log(`[Agent] Queue size: ${currentQueue.length}`);

                const results: TaskResult[] = [];
                let failedReportCount = 0;

                // Process tasks sequentially with delay
                for (const [taskIndex, task] of tasks.entries()) {
                    const result = await runExclusiveEmailSend(
                        `campaign queue item ${task.queueId}`,
                        () => sendEmail(task)
                    );
                    results.push(result);

                    // Persist result to disk BEFORE reporting to master.
                    // If the process crashes after SMTP send but before report,
                    // the result will be retried from disk on next startup.
                    const pendingFile = savePendingResult(result);

                    const reportSuccess = await report([result]);
                    if (reportSuccess) {
                        removePendingResult(pendingFile);
                    } else {
                        failedReportCount++;
                        logger.warn(`[Agent] Queue ${result.queueId} finished sending, but reporting to master failed after 5 retries. Result saved to disk for retry.`);
                    }

                    // Remove from queue after processing
                    const index = currentQueue.indexOf(task);
                    if (index > -1) {
                        currentQueue.splice(index, 1);
                    }

                    // Delay between sends
                    if (taskIndex < tasks.length - 1) {
                        await sleep(config.sendInterval);
                    }
                }

                isProcessing = false;

                if (failedReportCount === 0) {
                    log(`[Agent] Completed ${results.length} task(s), ${results.filter(r => r.success).length} successful`);
                } else {
                    log(`[Agent] Completed ${results.length} task(s), ${results.filter(r => r.success).length} successful, but ${failedReportCount} result(s) failed to report to master (saved to disk)`);
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
