// esbuild.shims.js
export const finished = () => Promise.resolve();
export const promisify = (fn) => fn;
export const streamPromises = { finished };
export const AsyncResource = class {};
export const performance = globalThis.performance;
export const DatabaseSync = class {};
export default {};
