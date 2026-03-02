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
    private logFilePath: string = '';
    private logFileName: string = '';
    private logsDir: string = '';
    private logFileDescriptor: number | null = null;

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

        // Open file descriptor for synchronous writes (more reliable with Bun)
        this.logFileDescriptor = fs.openSync(this.logFilePath, 'a');

        console.log(`[Logger] Logging to: ${this.logFilePath}`);
        this.log(LogLevel.INFO, `Agent logger initialized. Log file: ${this.logFileName}`);
    }

    private cleanupOldLogs() {
        try {
            const now = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days (reduced from 30 days for 512MB memory limit)
            const maxFileSize = 10 * 1024 * 1024; // 10MB max per file

            const files = fs.readdirSync(this.logsDir);
            let deletedCount = 0;
            let totalSize = 0;

            // Get all log files with their stats
            const logFiles = files
                .filter(file => file.endsWith('.log'))
                .map(file => {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    return { file, filePath, stats };
                })
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Newest first

            // Delete old logs or oversized logs
            for (const { file, filePath, stats } of logFiles) {
                const age = now - stats.mtime.getTime();

                if (age > maxAge || stats.size > maxFileSize) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`[Logger] Deleted log file: ${file} (age: ${Math.round(age / 86400000)}d, size: ${Math.round(stats.size / 1024)}KB)`);
                } else {
                    totalSize += stats.size;
                }
            }

            // Keep only last 20 log files to prevent disk space issues
            const remainingFiles = logFiles.filter(f => fs.existsSync(f.filePath));
            if (remainingFiles.length > 20) {
                for (let i = 20; i < remainingFiles.length; i++) {
                    fs.unlinkSync(remainingFiles[i].filePath);
                    deletedCount++;
                    console.log(`[Logger] Deleted old log file (keeping only 20 newest): ${remainingFiles[i].file}`);
                }
            }

            if (deletedCount > 0) {
                console.log(`[Logger] Cleaned up ${deletedCount} log file(s). Total remaining size: ${Math.round(totalSize / 1024)}KB`);
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

        // File output (JSON, single line) - use synchronous write for reliability
        if (this.logFileDescriptor !== null) {
            try {
                fs.writeSync(this.logFileDescriptor, logLine + '\n');
            } catch (error) {
                console.error('[Logger] Failed to write to log file:', error);
            }
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
        if (this.logFileDescriptor !== null) {
            try {
                fs.closeSync(this.logFileDescriptor);
            } catch (error) {
                console.error('[Logger] Error closing log file:', error);
            }
            this.logFileDescriptor = null;
        }
    }
}

export const logger = new AgentLogger();
