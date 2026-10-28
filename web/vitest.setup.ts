import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { webcrypto } from 'node:crypto';

// jsdom does not expose crypto.subtle — polyfill from Node's webcrypto
if (globalThis.crypto && !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: (webcrypto as Crypto).subtle,
    configurable: true,
  });
}

// jsdom does not implement ResizeObserver — provide a no-op stub
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

setupTestBed({ zoneless: true });
