# pCloud Cloud Storage Service

## Overview
The pCloud service implementation provides integration with pCloud's storage via its official JavaScript SDK. It supports both US and European data centers and handles authentication through OAuth2. The service maintains a mapping of paths to pCloud folder IDs to facilitate efficient navigation.

## API Documentation
- [pCloud API Reference](https://docs.pcloud.com/)
- [pCloud JavaScript SDK](https://github.com/pCloud/pcloud-sdk-js)

## Authentication
Authentication is handled via **OAuth 2.0**:
- Users are redirected to pCloud to authorize the application.
- The service requires a **Location ID** (1 for US, 2 for EU) to target the correct API endpoint.
- Redirect URI: Handled via Obsidian's protocol handler.

## Implementation Details & Gotchas
- **Regional Endpoints**:
    - **US**: `api.pcloud.com`
    - **Europe**: `eapi.pcloud.com`
- **ID-Based and Path-Based Operations**: The implementation uses a mix of folder IDs (for listing and creation) and full paths (for downloading and deletion).
- **Download Flow**: The pCloud API's `downloadfile` method returns a temporary link (a list of hosts and a path). The service must then perform a separate `fetch` to retrieve the actual file content from that link.
- **Path Resolution**: To minimize API calls, the service caches `folderid` mappings for paths it has already traversed. If a path is not in the cache, it resolves it step-by-step from the root.
- **Last Modified Time (mtime)**:
    - The service retrieves the `modified` date from pCloud metadata.
    - Note: The current implementation does not explicitly set a custom `mtime` during the upload process; pCloud's server-side modification time is used.
- **Versioning**: Basic support for listing and retrieving file revisions (versions) is implemented via `listRevisions`.

## Known Limitations
- **Stat Efficiency**: Retrieving metadata for a single item (`stat`) involves listing its parent folder and searching for the file name.
- **Large File Uploads**: Uses the standard SDK `upload` method, which might not be optimized for very large files compared to pCloud's block-upload APIs.
- **Empty Files**: Configuration allows skipping empty files if needed.
