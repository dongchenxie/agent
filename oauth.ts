/**
 * OAuth2 authentication for Email Loop Agent
 */

import { logger } from './logger';

/**
 * Get OAuth2 access token using refresh token
 * Supports Microsoft OAuth2 (Office 365, Outlook.com)
 */
export async function getOAuth2AccessToken(
    clientId: string,
    refreshToken: string,
    clientSecret?: string,
    tenantId?: string
): Promise<string | null> {
    try {
        const tokenUrl = tenantId
            ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
            : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

        const params = new URLSearchParams({
            client_id: clientId,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'https://outlook.office365.com/SMTP.Send https://outlook.office365.com/IMAP.AccessAsUser.All offline_access'
        });

        if (clientSecret) {
            params.append('client_secret', clientSecret);
        }

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error(`OAuth2 token refresh failed: ${error}`);
            return null;
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        logger.error('Error refreshing OAuth2 token:', error);
        return null;
    }
}
