import { webcrypto } from "node:crypto";

// Vitest's Node VM context doesn't expose globalThis.crypto by default.
// Node 18+ has Web Crypto under node:crypto; this polyfill bridges the gap.
(globalThis as unknown as { crypto: typeof webcrypto }).crypto = webcrypto;
