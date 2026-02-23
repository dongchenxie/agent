/**
 * Agent Log Uploader
 *
 * Periodically uploads agent logs to the master server:
 * - Uploads every 30 seconds
 * - Tracks upload offset to avoid duplicates
 * - Handles multiple log files
 * - Resilient to network failures
 */

import * as fs from 'fs';
import * as path from 'path';

interface UploadState {
    [filename: string]: {
        offset: number;
        lastUpload: string;
    };
}

export class LogUploader {
    private masterUrl: string;
    private agentToken: string | null = null;
    private logsDir: string;
    private stateFilePath: string;
    private uploadInterval: number = 30000; // 30 seconds
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(masterUrl: string, logsDir: string) {
        this.masterUrl = masterUrl;
        this.logsDir = logsDir;
        this.stateFilePath = path.join(logsDir, '.upload-state.json');
    }

    setToken(token: string) {
        this.agentToken = token;
    }

    start() {
        if (this.isRunning) {
            console.log('[LogUploader] Already running');
            return;
        }

        this.isRunning = true;
        console.log(`[LogUploader] Starting log upload (interval: ${this.uploadInterval}ms)`);

        // Upload immediately on start
        this.uploadLogs().catch(console.error);

        // Then upload periodically
        this.intervalId = setInterval(() => {
            this.uploadLogs().catch(console.error);
        }, this.uploadInterval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[LogUploader] Stopped');
    }

    private loadState(): UploadState {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                const data = fs.readFileSync(this.stateFilePath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('[LogUploader] Error loading state:', error);
        }
        return {};
    }

    private saveState(state: UploadState) {
        try {
            fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('[LogUploader] Error saving state:', error);
        }
    }

    private async uploadLogs() {
        if (!this.agentToken) {
            // Not registered yet, skip upload
            return;
        }

        try {
            // Get all log files
            const files = fs.readdirSync(this.logsDir)
                .filter(file => file.endsWith('.log'))
                .sort(); // Process in chronological order

            if (files.length === 0) {
                return;
            }

            const state = this.loadState();
            let uploadedLines = 0;

            for (const filename of files) {
                const filePath = path.join(this.logsDir, filename);
                const stats = fs.statSync(filePath);
                const fileSize = stats.size;

                // Get current offset for this file
                const currentOffset = state[filename]?.offset || 0;

                // Check if there's new content
                if (fileSize <= currentOffset) {
                    continue; // No new content
                }

                // Read new content from offset
                const newContent = this.readFileFromOffset(filePath, currentOffset);

                if (newContent.length === 0) {
                    continue;
                }

                const contentLength = Buffer.byteLength(newContent, 'utf-8');

                // Upload to master server with offset information
                const result = await this.uploadToMaster(filename, newContent, currentOffset, contentLength);

                if (result.success) {
                    // Update offset based on server response
                    const newOffset = result.fileSize || (currentOffset + contentLength);
                    state[filename] = {
                        offset: newOffset,
                        lastUpload: new Date().toISOString()
                    };

                    const lineCount = newContent.split('\n').filter(l => l.trim()).length;
                    uploadedLines += lineCount;

                    if (!result.appended) {
                        console.log(`[LogUploader] ${filename}: Duplicate detected (offset: ${currentOffset}), skipped`);
                    }
                }
            }

            // Save state
            if (uploadedLines > 0) {
                this.saveState(state);
                console.log(`[LogUploader] Uploaded ${uploadedLines} log line(s)`);
            }

        } catch (error) {
            console.error('[LogUploader] Error uploading logs:', error);
        }
    }

    private readFileFromOffset(filePath: string, offset: number): string {
        try {
            const fd = fs.openSync(filePath, 'r');
            const stats = fs.fstatSync(fd);
            const fileSize = stats.size;

            if (offset >= fileSize) {
                fs.closeSync(fd);
                return '';
            }

            const bufferSize = fileSize - offset;
            const buffer = Buffer.alloc(bufferSize);
            fs.readSync(fd, buffer, 0, bufferSize, offset);
            fs.closeSync(fd);

            return buffer.toString('utf-8');
        } catch (error) {
            console.error(`[LogUploader] Error reading file from offset:`, error);
            return '';
        }
    }

    private async uploadToMaster(
        filename: string,
        content: string,
        offset: number,
        length: number
    ): Promise<{ success: boolean; appended?: boolean; fileSize?: number }> {
        if (!this.agentToken) {
            console.error('[LogUploader] No agent token available');
            return { success: false };
        }

        try {
            // Remove trailing slash from masterUrl to avoid double slashes
            const baseUrl = this.masterUrl.replace(/\/$/, '');
            const url = `${baseUrl}/api/agents/logs`;
            console.log(`[LogUploader] Uploading to ${url}`, {
                filename,
                offset,
                length,
                contentPreview: content.substring(0, 100)
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Agent-Token': this.agentToken,
                    'X-Custom-Agent': 'RankScaleAIEmailAgent'
                },
                body: JSON.stringify({
                    filename,
                    content,
                    offset,
                    length,
                    timestamp: new Date().toISOString()
                })
            });

            console.log(`[LogUploader] Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                console.error(`[LogUploader] Upload failed with status ${response.status}`, {
                    contentType,
                    statusText: response.statusText
                });

                let errorMessage = `HTTP ${response.status}`;
                try {
                    if (contentType?.includes('application/json')) {
                        const error = await response.json();
                        errorMessage = error.error || JSON.stringify(error);
                        console.error(`[LogUploader] Error details:`, error);
                    } else {
                        const text = await response.text();
                        errorMessage = text.substring(0, 200);
                        console.error(`[LogUploader] Error response (non-JSON):`, text.substring(0, 500));
                    }
                } catch (parseError) {
                    console.error(`[LogUploader] Failed to parse error response:`, parseError);
                }

                console.error(`[LogUploader] Upload failed: ${errorMessage}`);
                return { success: false };
            }

            const contentType = response.headers.get('content-type');
            console.log(`[LogUploader] Success response content-type: ${contentType}`);

            let result;
            try {
                const text = await response.text();
                console.log(`[LogUploader] Response body:`, text.substring(0, 200));
                result = JSON.parse(text);
            } catch (parseError) {
                console.error(`[LogUploader] Failed to parse success response as JSON:`, parseError);
                console.error(`[LogUploader] Response was not valid JSON`);
                return { success: false };
            }

            console.log(`[LogUploader] Upload successful`, {
                appended: result.appended,
                reason: result.reason,
                fileSize: result.fileSize
            });

            return {
                success: true,
                appended: result.appended,
                fileSize: result.fileSize
            };
        } catch (error) {
            console.error('[LogUploader] Upload error (exception):', error);
            if (error instanceof Error) {
                console.error('[LogUploader] Error name:', error.name);
                console.error('[LogUploader] Error message:', error.message);
                console.error('[LogUploader] Error stack:', error.stack);
            }
            return { success: false };
        }
    }
}
