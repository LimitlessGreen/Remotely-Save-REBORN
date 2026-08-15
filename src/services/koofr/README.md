# Koofr Cloud Storage Service

## Overview
The Koofr service implementation provides connectivity to Koofr's cloud storage via its REST API. It uses a custom API client and OAuth2 for secure authentication. Koofr organizes storage into "mounts," and this service operates within a specified mount and base directory.

## API Documentation
- [Koofr REST API v2 (Interactive Docs)](https://app.koofr.net/api/v2/docs)
- [Koofr Official GitHub Organization](https://github.com/koofr)
- [rclone Koofr Documentation (Implementation Guide)](https://rclone.org/koofr/)
- [Koofr WebDAV Guide](https://koofr.eu/blog/posts/3-ways-to-map-koofr-as-a-network-drive-explained)

## Authentication
Authentication is handled via **OAuth 2.0**:
- Users are redirected to Koofr to authorize the application.
- The service handles automatic token refreshing using a `refreshToken`.
- **Mount ID**: The service requires a `mountID` to identify the storage area (usually the primary one).
- Redirect URI: `obsidian://remotely-save-cb-koofr`

## Implementation Details & Gotchas
- **Mount-Based Storage**: Operations are scoped to a specific `mountID`. The service typically targets the user's primary mount.
- **Path-Based API**: Unlike ID-based systems, Koofr's API uses file paths. These are passed as encoded query parameters (e.g., `?path=/folder/file.txt`).
- **Root Initialization**: On startup, the service ensures that the configured `remoteBaseDir` exists by attempting to create it.
- **Last Modified Time (mtime)**:
    - The service retrieves the `modified` timestamp (Unix epoch) from listing results.
    - Currently, the implementation does not support setting a custom `mtime` during file uploads; the server-side modification time is used.
- **Directory Operations**: `mkdir` and `listItems` follow standard hierarchical patterns.

## Known Limitations
- **Stat Performance**: To retrieve information about a single file (`stat`), the service lists its parent directory and filters the results, which can be slow for large folders.
- **Custom MTime**: There is no current support for preserving local file modification times on upload; Koofr sets the time when the file is received.
- **Large Files**: The current implementation uses simple `PUT` requests for uploads, which may not be optimal for very large files.
