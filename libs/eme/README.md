# EME

EME (Encrypt-Mix-Encrypt) wide-block encryption in TypeScript/JavaScript.

## Intro

Pure and full TypeScript/JavaScript port of <https://github.com/rfjakob/eme>.

Almost line-to-line "translation", with all the ported test cases.

## Usage

```bash
npm install @fyears/eme
```

```typescript
import { EMECipher, AESCipherBlock } from "@fyears/eme"
import { deepStrictEqual } from "assert"
import { webcrypto } from "crypto"

(async function(){
    const key = new Uint8Array([
        0,1,2,3,4,5,6,7,
        8,9,10,11,12,13,14,15
    ]) // 16-byte Uint8Array the user provided for the AES part

    const tweak = new Uint8Array(16)
    webcrypto.getRandomValues(tweak)  // iv

    const input = new Uint8Array(64) // some Uint8Array the user provided
    webcrypto.getRandomValues(input)

    const bc = new AESCipherBlock(key)
    const eme = new EMECipher(bc)

    const output = await eme.encrypt(tweak, input)
    const inputBack = await eme.decrypt(tweak, output)

    deepStrictEqual(inputBack, input)
})()
```

