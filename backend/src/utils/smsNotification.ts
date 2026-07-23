import { logger } from './logger';

interface SmsResult {
    sent: boolean;
    provider?: string;
    error?: string;
}

/**
 * Sends an SMS via MSG91 Flow API.
 * Silently skips (returns sent:false) when MSG91_AUTH_KEY is not configured
 * so the application submit route never fails due to SMS issues.
 */
export async function sendSms(phone: string, message: string): Promise<SmsResult> {
    const authKey  = process.env.MSG91_AUTH_KEY?.trim();
    const senderId = process.env.MSG91_SENDER_ID?.trim() || 'SEVAMT';

    if (!authKey) {
        logger.warn('SMS skipped — MSG91_AUTH_KEY not configured');
        return { sent: false, error: 'MSG91_AUTH_KEY not configured' };
    }

    // MSG91 requires 10-digit number prefixed with country code
    const mobile = `91${phone.replace(/\D/g, '').slice(-10)}`;

    try {
        const res = await fetch('https://api.msg91.com/api/v5/flow/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                authkey: authKey,
            },
            body: JSON.stringify({
                sender:    senderId,
                route:     '4',          // transactional route
                country:   '91',
                sms: [{ message, to: [mobile] }],
            }),
        });

        const data = await res.json() as any;

        if (data.type === 'success' || res.ok) {
            logger.info('SMS sent via MSG91', { mobile, requestId: data.request_id });
            return { sent: true, provider: 'msg91' };
        }

        logger.warn('MSG91 rejected SMS', { mobile, response: data });
        return { sent: false, provider: 'msg91', error: data.message || 'MSG91 error' };
    } catch (err: any) {
        logger.error('SMS send failed', { mobile, error: err.message });
        return { sent: false, error: err.message };
    }
}

/**
 * Builds the Hindi + English receipt SMS for a scheme application.
 */
export function buildReceiptSms(params: {
    name:          string;
    schemeTitle:   string;
    receiptNumber: string;
    phone:         string;
}): string {
    const { name, schemeTitle, receiptNumber } = params;
    return (
        `राम राम सा ${name} जी!\n` +
        `आपका आवेदन सफलतापूर्वक जमा हो गया है।\n` +
        `योजना: ${schemeTitle}\n` +
        `रसीद नंबर: ${receiptNumber}\n` +
        `अपने आवेदन की स्थिति जांचने के लिए Seva Mitra पर जाएं।\n` +
        `- Rajasthan e-Mitra AI`
    );
}
