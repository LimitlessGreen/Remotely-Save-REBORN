import { encryptArrayBuffer, decryptArrayBuffer } from './src/encryptOpenSSL';
import { webcrypto } from 'node:crypto';

// Polyfill window.crypto for Node.js
(global as any).window = {
    crypto: webcrypto
};

async function test() {
    const password = "somepassword";
    const saltHex = "8302F586FAB491EC";
    const data = new TextEncoder().encode("Hello World");

    console.log("Original data:", data);

    try {
        const encrypted = await encryptArrayBuffer(data.buffer, password, 20000, saltHex);
        console.log("Encrypted length:", encrypted.byteLength);
        console.log("Encrypted prefix (Hex):", Buffer.from(encrypted.slice(0, 16)).toString('hex'));

        const decrypted = await decryptArrayBuffer(encrypted, password, 20000);
        console.log("Decrypted data:", new TextDecoder().decode(decrypted));
    } catch (e) {
        console.error("Crypto failed:", e);
    }
}

test();
