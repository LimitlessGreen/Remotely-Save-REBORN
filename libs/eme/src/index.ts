import { ecb } from '@noble/ciphers/aes';

function multByTwo(output: Uint8Array, input: Uint8Array) {
    if (input.length !== 16) {
        throw Error("len must be 16")
    }
    const tmp = new Uint8Array(16)

    tmp[0] = 2 * input[0]

    if (input[15] >= 128) {
        tmp[0] = tmp[0] ^ 135
    }
    for (let j = 1; j < 16; j++) {
        tmp[j] = 2 * input[j]
        if (input[j - 1] >= 128) {
            tmp[j] = tmp[j] + 1
        }
    }
    output.set(tmp);
}

function xorBlocks(output: Uint8Array, input1: Uint8Array, input2: Uint8Array) {
    if (input1.length !== input2.length) {
        throw Error(`input1.length=${input1.length} is not equal to input2.length=${input2.length}`)
    }

    for (let i = 0; i < input1.length; ++i) {
        output[i] = input1[i] ^ input2[i]
    }
}

export interface CipherBlock {
    encrypt: (dst: Uint8Array, src: Uint8Array) => Promise<void>,
    decrypt: (dst: Uint8Array, src: Uint8Array) => Promise<void>,
    blockSize: () => number
}

// aesTransform - encrypt or decrypt (according to "isEncrypt") using block
// cipher "bc" (typically AES)
async function aesTransform(dst: Uint8Array, src: Uint8Array, isEncrypt: boolean, bc: CipherBlock) {
    if (isEncrypt) {
        await bc.encrypt(dst, src)
    } else {
        await bc.decrypt(dst, src)
    }
}

// tabulateL - calculate L_i for messages up to a length of m cipher blocks
async function tabulateL(bc: CipherBlock, m: number) {
    /* set L0 = 2*AESenc(K; 0) */
    const eZero = new Uint8Array(16)
    const Li = new Uint8Array(16)
    await bc.encrypt(Li, eZero)

    const LTable = new Array(m) as Array<Uint8Array>;
    for (let i = 0; i < m; i++) {
        multByTwo(Li, Li)
        LTable[i] = new Uint8Array(Li)
    }
    return LTable
}

// Transform - EME-encrypt or EME-decrypt, according to "isEncrypt"
// (defined in the constants isEncryptEncrypt and isEncryptDecrypt).
// The data in "inputData" is en- or decrypted with the block ciper "bc" under
// "tweak" (also known as IV).
//
// The tweak is used to randomize the encryption in the same way as an
// IV.  A use of this encryption mode envisioned by the authors of the
// algorithm was to encrypt each sector of a disk, with the tweak
// being the sector number.  If you encipher the same data with the
// same tweak you will get the same ciphertext.
//
// The result is returned in a freshly allocated subarray of the same
// size as inputData.
//
// Limitations:
// * The block cipher must have block size 16 (usually AES).
// * The size of "tweak" must be 16
// * "inputData" must be a multiple of 16 bytes long
// If any of these pre-conditions are not met, the function will panic.
//
// Note that you probably don't want to call this function directly and instead
// use eme.New(), which provides conventient wrappers.
async function transform(bc: CipherBlock, tweak: Uint8Array, inputData: Uint8Array, isEncrypt: boolean): Promise<Uint8Array> {
    // In the paper, the tweak is just called "T". Call it the same here to
    // make following the paper easy.
    const T = tweak
    // In the paper, the plaintext data is called "P" and the ciphertext is
    // called "C". Because encryption and decryption are virtually identical,
    // we share the code and always call the input data "P" and the output data
    // "C", regardless of the isEncrypt.
    const P = inputData

    if (bc.blockSize() !== 16) {
        throw Error("Using a block size other than 16 is not implemented")
    }
    if (T.length !== 16) {
        throw Error(`Tweak must be 16 bytes long, is ${T.length}`)
    }
    if (P.length % 16 !== 0) {
        throw Error(`Data P must be a multiple of 16 long, is ${P.length}`)
    }
    const m = P.length / 16
    if (m === 0 || m > 16 * 8) {
        throw Error(`EME operates on 1 to ${16 * 8} block-cipher blocks, you passed ${m}`)
    }

    const C = new Uint8Array(P.length)

    const LTable = await tabulateL(bc, m)

    const PPj = new Uint8Array(16)
    for (let j = 0; j < m; j++) {
        const Pj = P.subarray(j * 16, (j + 1) * 16)
        /* PPj = 2**(j-1)*L xor Pj */
        xorBlocks(PPj, Pj, LTable[j])
        /* PPPj = AESenc(K; PPj) */
        await aesTransform(C.subarray(j * 16, (j + 1) * 16), PPj, isEncrypt, bc)
    }

    /* MP =(xorSum PPPj) xor T */
    const MP = new Uint8Array(16)
    xorBlocks(MP, C.subarray(0, 16), T)
    for (let j = 1; j < m; j++) {
        xorBlocks(MP, MP, C.subarray(j * 16, (j + 1) * 16))
    }

    /* MC = AESenc(K; MP) */
    const MC = new Uint8Array(16)
    await aesTransform(MC, MP, isEncrypt, bc)

    /* M = MP xor MC */
    const M = new Uint8Array(16)
    xorBlocks(M, MP, MC)
    const CCCj = new Uint8Array(16)
    for (let j = 1; j < m; j++) {
        multByTwo(M, M)
        /* CCCj = 2**(j-1)*M xor PPPj */
        xorBlocks(CCCj, C.subarray(j * 16, (j + 1) * 16), M)
        C.subarray(j * 16, (j + 1) * 16).set(CCCj)
    }

    /* CCC1 = (xorSum CCCj) xor T xor MC */
    const CCC1 = new Uint8Array(16)
    xorBlocks(CCC1, MC, T)
    for (let j = 1; j < m; j++) {
        xorBlocks(CCC1, CCC1, C.subarray(j * 16, (j + 1) * 16))
    }
    C.subarray(0, 16).set(CCC1)

    for (let j = 0; j < m; j++) {
        /* CCj = AES-enc(K; CCCj) */
        await aesTransform(C.subarray(j * 16, (j + 1) * 16), C.subarray(j * 16, (j + 1) * 16), isEncrypt, bc)
        /* Cj = 2**(j-1)*L xor CCj */
        xorBlocks(C.subarray(j * 16, (j + 1) * 16), C.subarray(j * 16, (j + 1) * 16), LTable[j])
    }

    return C
}

export class EMECipher {
    bc: CipherBlock
    constructor(bc: CipherBlock) {
        this.bc = bc
    }

    async encrypt(tweak: Uint8Array, inputData: Uint8Array) {
        return await transform(this.bc, tweak, inputData, true)
    }

    async decrypt(tweak: Uint8Array, inputData: Uint8Array) {
        return await transform(this.bc, tweak, inputData, false)
    }
}

export class AESCipherBlock implements CipherBlock {
    keyRaw: Uint8Array
    algo: string
    iv: Uint8Array

    constructor(keyRaw: Uint8Array) {
        this.keyRaw = keyRaw;
        this.iv = new Uint8Array(16);

        if (keyRaw.length === 16) {
            this.algo = 'aes128'
        } else if (keyRaw.length === 24) {
            this.algo = 'aes192'
        } else if (keyRaw.length === 32) {
            this.algo = 'aes256'
        } else {
            throw Error(`invalid key length = ${keyRaw.length}`)
        }
    }

    async encrypt(dst: Uint8Array, src: Uint8Array) {
        const stream = ecb(this.keyRaw, {disablePadding:true});
        dst.set([...stream.encrypt(src)]);
    }

    async decrypt(dst: Uint8Array, src: Uint8Array) {
        const stream = ecb(this.keyRaw, {disablePadding: true});
        dst.set([...stream.decrypt(src)]);
    }

    blockSize() {
        return 16
    }
}
