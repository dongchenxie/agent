/**
 * Constants used by the Email Loop Agent
 */

// 100+ real email client User-Agent strings for X-Mailer header
export const EMAIL_CLIENTS = [
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

    // Mutt
    'Mutt/2.2.9',
    'Mutt/2.1.5',
    'Mutt/1.14.7',

    // Pine/Alpine
    'Alpine 2.26',
    'Alpine 2.25',
    'Pine 4.64',

    // Spark
    'Spark 2.11.23',
    'Spark 2.10.5',

    // Newton Mail
    'Newton Mail 11.0.85',
    'Newton Mail 10.0.45',

    // Airmail
    'Airmail 5.6.3',
    'Airmail 5.5.2',
    'Airmail 4.5.4',

    // Spike
    'Spike 3.4.0',
    'Spike 3.3.5',

    // Polymail
    'Polymail 2.0.1',
    'Polymail 1.9.8',
];

/**
 * Get a consistent X-Mailer header for a given email address
 * Uses email hash to ensure same email always gets same client
 */
export function getXMailerForEmail(email: string): string {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    const index = Math.abs(hash) % EMAIL_CLIENTS.length;
    return EMAIL_CLIENTS[index];
}
