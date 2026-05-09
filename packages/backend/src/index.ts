import * as path from 'node:path';
import * as dotenv from 'dotenv';

// CommonJS build target: __dirname is provided natively. tsx (dev) also supplies it.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import('./server.js').then((m) => m.startServer()).catch((e) => { console.error(e); process.exit(1); });

