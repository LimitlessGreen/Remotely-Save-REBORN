# Webdis (Redis HTTP) Storage Service

## Overview
Webdis is an HTTP interface to Redis. This service implementation is intended to allow syncing vault data to a Redis instance via Webdis. However, the current implementation is a **stub** and is not yet functional.

## API Documentation
- [Webdis GitHub Repository](https://github.com/nicolasff/webdis)
- [Redis Command Documentation](https://redis.io/commands)

## Authentication
- **Methods**: Supports Basic authentication.
- **Credentials**: Requires a Webdis server address, username (optional), and password.

## Implementation Details & Gotchas
- **Stubbed Status**: The core file system operations (`walk`, `stat`, `readFile`, `writeFile`, etc.) are currently not implemented and will throw errors if called.
- **Data Model**: The proposed data model uses Redis keys with a specific prefix: `rs:fs:v1:<vaultName>/<path>`. Metadata would likely be stored in a separate key with a `:meta` suffix.
- **Redis as a File System**: Implementing a hierarchical file system on top of a flat key-value store like Redis requires careful management of directory listings (e.g., using `SCAN` with patterns) and handling binary data as blobs or strings.

## Known Limitations
- **Functionality**: The service is **not functional** in the current version of the plugin.
- **Consistency**: Redis is an in-memory store by default; persistence settings on the server side are critical for data safety.
- **Performance**: Operations like recursive listings (`walk`) can be computationally expensive on Redis if there are millions of keys.
