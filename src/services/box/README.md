# Box Cloud Storage Service

## Overview
The Box service implementation integrates with the Box Content Cloud. It uses the official Box TypeScript SDK (generated) to perform file and folder operations. Since Box uses unique IDs for items rather than file paths, this implementation maintains a path-to-ID cache and resolves paths by traversing the folder hierarchy when necessary.

## API Documentation
- [Box API Reference](https://developer.box.com/reference/)
- [Box TypeScript SDK](https://github.com/box/box-typescript-sdk-gen)

## Authentication
Authentication is handled via **OAuth 2.0 (Standard Flow)**:
- Users are redirected to Box to authorize the application.
- The service handles automatic token refreshing using a `refreshToken`.
- Redirect URI: `obsidian://remotely-save-cb-box`

## Implementation Details & Gotchas
- **ID-Based Navigation**: Every file and folder in Box has a unique ID. To perform operations on a path (e.g., `/folder/file.txt`), the service must first find the ID of `folder` and then search for `file.txt` within it.
- **Path Resolution Cache**: A local cache maps paths to Box IDs to minimize API calls for traversal.
- **Root Directory**: The service operates within a specific "Remote Base Directory" (defaults to the vault name). This directory is looked up or created under the user's root folder (ID `0`) upon initialization.
- **Last Modified Time (mtime)**:
    - The implementation uses the `content_modified_at` attribute in Box to store and retrieve file modification times.
    - During upload, the local file's `mtime` is sent to Box.
- **Uploads**:
    - New files use the `uploadFile` (Preflight check + Upload) flow.
    - Existing files use `uploadFileVersion` to create a new version of the file.
- **Rate Limiting**: Box has strict rate limits. The current implementation does not explicitly handle 429 errors with retries beyond what the SDK might provide.

## Known Limitations
- **Stat Performance**: The `stat` operation is currently implemented by listing the parent directory and finding the item, which can be inefficient for folders with thousands of files.
- **Recursive Walk**: Large directory structures may take time to "walk" as the implementation traverses folders sequentially or recursively.
- **Path Case Sensitivity**: Box is generally case-insensitive for file names within the same folder, but the implementation relies on the SDK and API behavior.
