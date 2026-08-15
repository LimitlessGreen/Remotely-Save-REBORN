# Internxt Cloud Storage Service

## Overview
Internxt is a zero-knowledge cloud storage service that emphasizes privacy through client-side encryption. This implementation integrates with the Internxt Drive and Network APIs using the official SDK. It handles the complex process of encrypting file contents and filenames locally before they are uploaded to Internxt's decentralized network.

## API Documentation
- [Internxt Official GitHub (SDKs & CLI)](https://github.com/internxt)
- [Internxt Help Center](https://help.internxt.com)
- [Internxt JavaScript SDK](https://github.com/internxt/sdk)

## Authentication
Authentication is handled via **Email and Password**:
- Upon login, the service retrieves an auth **token** and a **mnemonic**.
- The **mnemonic** is vital as it is used to derive the encryption keys for your files.
- The service also identifies specific user metadata: `rootFolderUuid`, `bucketId`, `bridgeUser`, and `userId`.

## Implementation Details & Gotchas
- **Zero-Knowledge Encryption**: 
    - File contents are encrypted using **AES-256-CTR**.
    - Filenames are also encrypted to prevent the service from knowing the file structure.
    - Integrity is verified using a double-hash (SHA256 followed by RIPEMD160).
- **Complex Upload/Download Flow**:
    - Uploading a file involves multiple steps: starting the upload on the network, encrypting and hashing the data, pushing it to a storage shard, finishing the network upload, and finally creating a "Drive" entry to link the network file to a folder.
- **0-Byte File Workaround**: Internxt's network architecture does not support 0-byte files. The service transparently substitutes a single space (1 byte) for empty files.
- **Consistency Polling**: Due to the distributed nature of the service, metadata might not be immediately available after a write operation. The implementation includes polling loops (with delays) to ensure operations like `writeFile` or `rm` have been fully processed before continuing.
- **CORS**: Large binary operations (PUT/GET) use Obsidian's `requestUrl` to bypass potential browser restrictions.

## Known Limitations
- **Performance**: The multi-step API process and local cryptographic operations make Internxt significantly slower than traditional cloud providers.
- **Memory Usage**: Encrypting large files in memory (using `Buffer`) can be resource-intensive.
- **Stat Efficiency**: To retrieve a single file's metadata (`stat`), the service lists the parent folder's contents and searches for the target, which adds overhead.
- **Mnemonic Safety**: The encryption depends entirely on the mnemonic. If it's changed or lost, previously synced data becomes inaccessible.
