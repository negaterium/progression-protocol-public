import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

/** Hide terminal input; piped stdin also works without putting a secret in argv. */
export async function promptPassword(label = 'Password: '): Promise<string> {
    const input = process.stdin;
    if (!input.isTTY) {
        const reader = createInterface({ input, crlfDelay: Infinity });
        try {
            for await (const line of reader) return line;
            throw new Error('No password was supplied on stdin.');
        } finally {
            reader.close();
        }
    }
    process.stdout.write(label);
    const silentOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const reader = createInterface({ input, output: silentOutput, terminal: true });
    return new Promise((resolve, reject) => {
        reader.once('line', password => { reader.close(); process.stdout.write('\n'); resolve(password); });
        reader.once('SIGINT', () => { reader.close(); process.stdout.write('\n'); reject(new Error('Cancelled.')); });
    });
}
