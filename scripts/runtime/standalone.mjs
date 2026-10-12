import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Copied beside generated server.js in the standalone image. Uses the compiled
// shared validator, with no TypeScript runner or extra runtime dependencies.
const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'production';
delete process.env.NEXT_PHASE;
try {
    const { register } = require(join(dir, '.next/server/instrumentation.js'));
    await register();
    await import(pathToFileURL(join(dir, 'server.js')).href);
} catch (error) {
    console.error(error?.name === 'ConfigurationError' ? error.message : 'Standalone startup failed. Check the complete build artifact and configuration.');
    process.exitCode = 1;
}
