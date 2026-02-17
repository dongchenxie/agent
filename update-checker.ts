/**
 * Email Loop Agent - Update Checker
 *
 * This module periodically checks for updates from GitHub
 * and triggers auto-update when a new version is available
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface UpdateCheckerConfig {
  checkInterval: number; // in milliseconds
  repoUrl: string;
  branch: string;
  autoUpdate: boolean;
  getQueueSize?: () => number; // Function to get current queue size
  stopPolling?: () => void; // Function to stop polling for new tasks
}

export class UpdateChecker {
  public config: UpdateCheckerConfig;
  private checkTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastCheckTime: Date | null = null;
  private currentCommit: string | null = null;

  constructor(config?: Partial<UpdateCheckerConfig>) {
    this.config = {
      checkInterval: 5 * 60 * 1000, // Default: 5 minutes
      repoUrl: 'https://github.com/dongchenxie/agent.git',
      branch: 'master',
      autoUpdate: true,
      ...config,
    };
  }

  /**
   * Start periodic update checking
   */
  start() {
    console.log('[UpdateChecker] Starting update checker...');
    console.log(`[UpdateChecker] Check interval: ${this.config.checkInterval / 1000}s`);
    console.log(`[UpdateChecker] Auto-update: ${this.config.autoUpdate ? 'enabled' : 'disabled'}`);

    // Check immediately on start
    this.checkForUpdates();

    // Then check periodically
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  /**
   * Stop update checking
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('[UpdateChecker] Update checker stopped');
    }
  }

  /**
   * Check for updates from GitHub
   */
  private async checkForUpdates() {
    if (this.isChecking) {
      console.log('[UpdateChecker] Already checking for updates, skipping...');
      return;
    }

    this.isChecking = true;
    this.lastCheckTime = new Date();

    try {
      console.log('[UpdateChecker] Checking for updates...');

      // Get current commit hash
      const { stdout: localCommit } = await execAsync('git rev-parse HEAD');
      const currentCommit = localCommit.trim();

      if (!this.currentCommit) {
        this.currentCommit = currentCommit;
        console.log(`[UpdateChecker] Current version: ${currentCommit.substring(0, 7)}`);
      }

      // Fetch latest changes
      await execAsync(`git fetch origin ${this.config.branch}`);

      // Get remote commit hash
      const { stdout: remoteCommit } = await execAsync(`git rev-parse origin/${this.config.branch}`);
      const latestCommit = remoteCommit.trim();

      console.log(`[UpdateChecker] Local:  ${currentCommit.substring(0, 7)}`);
      console.log(`[UpdateChecker] Remote: ${latestCommit.substring(0, 7)}`);

      // Check if update is available
      if (currentCommit !== latestCommit) {
        console.log('[UpdateChecker] ✨ New version available!');

        if (this.config.autoUpdate) {
          await this.performUpdate();
        } else {
          console.log('[UpdateChecker] Auto-update is disabled. Please update manually.');
          console.log('[UpdateChecker] Run: ./auto-update.sh');
        }
      } else {
        console.log('[UpdateChecker] ✓ Already up to date');
      }
    } catch (error) {
      console.error('[UpdateChecker] Error checking for updates:', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Perform auto-update
   */
  private async performUpdate() {
    try {
      console.log('[UpdateChecker] Starting auto-update...');

      // Stop polling for new tasks
      if (this.config.stopPolling) {
        console.log('[UpdateChecker] Stopping task polling...');
        this.config.stopPolling();
      }

      // Wait for queue to be empty
      if (this.config.getQueueSize) {
        console.log('[UpdateChecker] Waiting for email queue to be empty...');

        let queueSize = this.config.getQueueSize();
        let waitCount = 0;
        const maxWaitMinutes = 30; // Maximum wait time: 30 minutes
        const checkIntervalSeconds = 5;

        while (queueSize > 0 && waitCount < (maxWaitMinutes * 60 / checkIntervalSeconds)) {
          console.log(`[UpdateChecker] Queue size: ${queueSize}, waiting...`);
          await new Promise(resolve => setTimeout(resolve, checkIntervalSeconds * 1000));
          queueSize = this.config.getQueueSize();
          waitCount++;
        }

        if (queueSize > 0) {
          console.error(`[UpdateChecker] Queue still has ${queueSize} emails after ${maxWaitMinutes} minutes. Aborting update.`);
          console.log('[UpdateChecker] Please update manually when queue is empty: ./auto-update.sh');
          return;
        }

        console.log('[UpdateChecker] ✓ Queue is empty, proceeding with update');
      }

      // Check if auto-update script exists
      const scriptPath = join(process.cwd(), 'auto-update.sh');
      if (!existsSync(scriptPath)) {
        console.error('[UpdateChecker] auto-update.sh not found!');
        return;
      }

      // Make script executable
      await execAsync(`chmod +x ${scriptPath}`);

      // Run update script
      console.log('[UpdateChecker] Running update script...');
      const { stdout, stderr } = await execAsync('./auto-update.sh');

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      console.log('[UpdateChecker] Update completed successfully');
      console.log('[UpdateChecker] Service will restart automatically');

      // The service will be restarted by the update script
      // Exit this process to let the new one take over
      console.log('[UpdateChecker] Exiting old process...');
      process.exit(0);
    } catch (error) {
      console.error('[UpdateChecker] Error performing update:', error);
      console.log('[UpdateChecker] Please update manually: ./auto-update.sh');
    }
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      isChecking: this.isChecking,
      lastCheckTime: this.lastCheckTime,
      currentCommit: this.currentCommit,
      checkInterval: this.config.checkInterval,
      autoUpdate: this.config.autoUpdate,
    };
  }

  /**
   * Force check for updates now
   */
  async checkNow() {
    console.log('[UpdateChecker] Manual update check triggered');
    await this.checkForUpdates();
  }
}

// Export singleton instance
export const updateChecker = new UpdateChecker({
  checkInterval: parseInt(process.env.UPDATE_CHECK_INTERVAL || '300000'), // Default: 5 minutes
  autoUpdate: process.env.AUTO_UPDATE !== 'false', // Default: enabled
});
