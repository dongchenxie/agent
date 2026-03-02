/**
 * Type definitions for Email Loop Agent
 */

export interface Task {
    queueId: number;
    campaignId: number | null;
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
        host: string;
        port: number;
        secure: boolean;
        authType?: string;
        clientId?: string;
        clientSecret?: string;
        refreshToken?: string;
        tenantId?: string;
        accessToken?: string;
        tokenExpiresAt?: string;
    };
}

export interface TaskResult {
    queueId: number;
    success: boolean;
    smtpEmail: string;
    error?: string;
}

export interface ImapTask {
    type: 'imap_check';
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

export interface ReceivedEmail {
    from: string;
    subject: string;
    date: Date;
    messageId: string;
    inReplyTo?: string;
    references?: string[];
    body: string;
}

export interface ImapTaskResult {
    accountId: number;
    success: boolean;
    emails: ReceivedEmail[];
    error?: string;
}

export interface AgentConfig {
    pollInterval: number;
    sendInterval: number;
    batchSize: number;
}
