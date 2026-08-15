# WebDAV Cloud Storage Service

## Overview
The WebDAV service implementation provides a standards-based connection to various cloud storage providers (Nextcloud, OwnCloud, Synology, etc.). It utilizes the `webdav` JavaScript client library and includes custom patches to work within the Obsidian environment, particularly for bypassing CORS and handling platform-specific quirks.

## API Documentation
- [WebDAV RFC 4918](https://datatracker.ietf.org/doc/html/rfc4918)
- [WebDAV Client for JavaScript](https://github.com/perry-mitchell/webdav-client)
- [Nextcloud Developer Manual - WebDAV](https://docs.nextcloud.com/server/latest/developer_manual/client_developer_manual/webdav/index.html)

## Authentication
- **Methods**: Supports **Basic** and **Digest** authentication.
- **Credentials**: Requires an address (URL), username, and password (or app-specific password).
- **Custom Headers**: Allows users to specify additional HTTP headers for specialized server configurations.

## Implementation Details & Gotchas
- **CORS Bypassing**: The `webdav` library's internal request mechanism is patched to use Obsidian's `requestUrl` API. This allows the plugin to communicate with WebDAV servers even if they do not have permissive CORS headers.
- **Depth Support**:
    - **Depth: 1**: Lists only the immediate contents of a directory. The service performs manual recursive walks if needed.
    - **Depth: infinity**: Attempts to fetch the entire tree in one request (if supported by the server).
- **Nextcloud Versioning**:
    - The implementation includes specialized logic for Nextcloud.
    - It retrieves the internal `fileid` via a `PROPFIND` request with the `oc:fileid` property.
    - Versions are accessed through the `remote.php/dav/versions/<user>/versions/<fileid>` endpoint.
- **iOS Compatibility**: Includes a workaround for iOS where `PROPFIND` requests might return a 401 if the directory URL does not end with a trailing slash.
- **Last Modified Time (mtime)**: Uses the standard `getlastmodified` property from the WebDAV server.

## Known Limitations
- **Digest Authentication**: Only available when Obsidian's `requestUrl` API is active.
- **Server Support**: Some WebDAV implementations (e.g., those in certain NAS devices) may have non-standard behaviors regarding property names or recursive listings.
- **Performance**: Recursive walks with `Depth: 1` can be slow on high-latency connections compared to a single `Depth: infinity` call.
