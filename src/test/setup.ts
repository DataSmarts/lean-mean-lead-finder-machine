import { webcrypto } from "node:crypto";

// Node 18-21: globalThis.crypto is absent — polyfill it.
// Node 22+: it's a non-writable native getter; skip the assignment.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
