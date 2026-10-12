import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug_auth.log');

export function logDebug(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;

    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error("Failed to write to debug log:", e);
    }
}
