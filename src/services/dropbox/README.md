# Dropbox Cloud Storage Service

## Overview
The Dropbox service implementation provides integration with Dropbox via its official JavaScript SDK. It supports secure OAuth2 authentication with PKCE and handles Dropbox-specific behaviors such as case-insensitive paths and rate limiting.

## API Documentation
- [Dropbox HTTP API Reference](https://www.dropbox.com/developers/documentation/http/documentation)
- [Dropbox JavaScript SDK](https://github.com/dropbox/dropbox-sdk-js)

## Authentication
Authentication is handled via **OAuth 2.0 with PKCE**:
- Users are redirected to Dropbox to authorize the application.
- The service requests "offline" access to obtain a `refreshToken` for automatic background token updates.
- Redirect URI: `obsidian://remotely-save-cb-dropbox` (with a fallback for platforms where protocol handlers are problematic).

## Implementation Details & Gotchas
- **Case Sensitivity**: Dropbox is case-insensitive but case-preserving. To avoid sync conflicts, the implementation includes a `fixEntityListCasesInplace` utility that ensures remote paths are correctly mapped to their preserved cases during listings.
- **Rate Limiting & Contention**:
    - Dropbox frequently returns `429 Too Many Requests` or `409 Conflict` (specifically `too_many_write_operations`).
    - The service implements a robust `retryReq` wrapper with exponential backoff and jitter to handle these transient errors.
- **Last Modified Time (mtime)**:
    - Uses `client_modified` to preserve the original file timestamp from the local vault.
    - `server_modified` is also tracked as the time of upload.
- **Path Constraints**:
    - Emojis in folder names are explicitly restricted in this implementation to avoid potential API issues.
    - API paths are prefixed with `/`, while internal vault paths are relative.
- **Pagination**: Large directory listings are handled using `filesListFolder` and `filesListFolderContinue`.

## Known Limitations
- **Large Files**: The current implementation uses the simple `filesUpload` method, which is limited to 150MB per file by Dropbox. Large file chunking is not currently implemented.
- **Emoji Restrictions**: Folders containing emojis will trigger an error during creation.
- **Write Performance**: Due to Dropbox's architecture, rapid write operations to the same folder can lead to contention and slowed performance.
