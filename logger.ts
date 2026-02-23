/**
 * Agent Logger
 *
 * Lightweight logger for agent with:
 * - Local file storage in agent/logs/
 * - Auto-cleanup of logs older than 30 days
 * - JSON format for easy parsing
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: unknown;
    error?: {
        message: string;
        stack?: string;
        name?: string;
    };
}

class AgentLogger {
    private logFileStream: fs.WriteStream | null = null;
    private logFilePath: string = '';
    private logFileName: string = '';
    private logsDir: string = '';

    constructor() {
        // Initialize on first use
    }

    init(baseDir: string = __dirname) {
        this.logsDir = path.join(baseDir, 'logs');

        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        // Clean up old logs (older than 30 days)
        this.cleanupOldLogs();

        // Create new log file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFileName = `run-${timestamp}.log`;
        this.logFilePath = path.join(this.logsDir, this.logFileName);
        this.logFileStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });

        console.log(`[Logger] Logging to: ${this.logFilePath}`);
        this.log(LogLevel.INFO, `Agent logger initialized. Log file: ${this.logFileName}`);
    }

    private cleanupOldLogs() {
        try {
            const now = Date.now();
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

            const files = fs.readdirSync(this.logsDir);
            let deletedCount = 0;

            for (const file of files) {
                if (!file.endsWith('.log')) continue;

                const filePath = path.join(this.logsDir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtime.getTime();

                if (age > maxAge) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`[Logger] Deleted old log file: ${file}`);
                }
            }

            if (deletedCount > 0) {
                console.log(`[Logger] Cleaned up ${deletedCount} old log file(s)`);
            }
        } catch (error) {
            console.error('[Logger] Error cleaning up old logs:', error);
        }
    }

    private formatLogEntry(level: LogLevel, message: string, data?: unknown): string {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
        };

        // Handle Error objects
        if (data instanceof Error) {
            entry.error = {
                name: data.name,
                message: data.message,
                stack: data.stack?.replace(/\n/g, '\\n'),
            };
        } else if (data !== undefined) {
            entry.data = data;
        }

        return JSON.stringify(entry);
    }

    private log(level: LogLevel, message: string, data?: unknown) {
        const logLine = this.formatLogEntry(level, message, data);

        // Console output with color
        const coloredOutput = this.colorizeConsoleOutput(level, logLine);
        if (level === LogLevel.ERROR) {
            console.error(coloredOutput);
        } else {
            console.log(coloredOutput);
        }

        // File output (JSON, single line)
        if (this.logFileStream) {
            this.logFileStream.write(logLine + '\n');
        }
    }

    private colorizeConsoleOutput(level: LogLevel, logLine: string): string {
        try {
            const entry = JSON.parse(logLine) as LogEntry;
            const colors = {
                DEBUG: '\x1b[36m', // Cyan
                INFO: '\x1b[32m',  // Green
                WARN: '\x1b[33m',  // Yellow
                ERROR: '\x1b[31m', // Red
            };
            const reset = '\x1b[0m';
            const color = colors[level] || '';

            let output = `${color}[${entry.timestamp}] [${entry.level}]${reset} ${entry.message}`;

            if (entry.data) {
                output += ` ${JSON.stringify(entry.data)}`;
            }

            if (entry.error) {
                output += `\n${color}Error: ${entry.error.message}${reset}`;
                if (entry.error.stack) {
                    output += `\n${entry.error.stack.replace(/\\n/g, '\n')}`;
                }
            }

            return output;
        } catch {
            return logLine;
        }
    }

    debug(message: string, data?: unknown) {
        this.log(LogLevel.DEBUG, message, data);
    }

    info(message: string, data?: unknown) {
        this.log(LogLevel.INFO, message, data);
    }

    warn(message: string, data?: unknown) {
        this.log(LogLevel.WARN, message, data);
    }

    error(message: string, error?: unknown) {
        this.log(LogLevel.ERROR, message, error);
    }

    getLogFilePath(): string {
        return this.logFilePath;
    }

    getLogFileName(): string {
        return this.logFileName;
    }

    getLogsDir(): string {
        return this.logsDir;
    }

    close() {
        if (this.logFileStream) {
            this.logFileStream.end();
            this.logFileStream = null;
        }
    }
}

export const logger = new AgentLogger();
