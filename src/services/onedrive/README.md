# Microsoft OneDrive Storage Service

## Overview
The OneDrive service implementation connects to Microsoft OneDrive using the Microsoft Graph API v1.0. It supports two modes of operation: "App Folder" (isolated storage for the plugin) and "Full Drive" (access to any folder in the user's OneDrive). The service uses a custom API client and OAuth2 with PKCE for secure authentication.

## API Documentation
- [Microsoft Graph OneDrive API Reference](https://learn.microsoft.com/en-us/graph/api/resources/onedrive?view=graph-rest-1.0)
- [Microsoft Graph Authentication Documentation](https://learn.microsoft.com/en-us/graph/auth-v2-user)

## Authentication
Authentication is handled via **OAuth 2.0 with PKCE**:
- **Authority**: `https://login.microsoftonline.com/common` (handles both personal and work/school accounts).
- **Scopes**:
    - **App Folder mode**: `User.Read`, `Files.ReadWrite.AppFolder`, `offline_access`.
    - **Full Drive mode**: `User.Read`, `Files.ReadWrite`, `offline_access`.
- The service handles automatic token refreshing using a `refreshToken`.
- Redirect URI: `obsidian://remotely-save-cb-onedrive` (or `-onedrivefull`).

## Implementation Details & Gotchas
- **Two Storage Scopes**:
    - **App Folder**: Items are stored in a dedicated folder under `Apps/Remotely Save`. This is the recommended mode for privacy and security.
    - **Full Drive**: Items can be stored anywhere in the user's OneDrive root.
- **Path Addressing**: The Graph API uses a specific syntax for path-based access: `.../root:/path/to/item`. This service correctly formats these paths for all operations.
- **Download Mechanism**: Downloading a file is a two-step process: first, the service retrieves the item's metadata to get a short-lived `@microsoft.graph.downloadUrl`, then it fetches the content from that URL.
- **Last Modified Time (mtime)**: The service uses the `lastModifiedDateTime` property provided by OneDrive. Note that Microsoft Graph also supports a `fileSystemInfo` property for client-provided timestamps, but the current implementation relies on the standard API behavior.
- **Hashes**: OneDrive provides SHA1 hashes for files, which can be used for integrity checks.
- **Conflict Behavior**: Folder creation uses the `@microsoft.graph.conflictBehavior: replace` setting to handle existing folders gracefully.

## Known Limitations
- **4MB Upload Limit**: The current implementation uses a single `PUT` request to `/content` for file uploads. This method is limited to files smaller than 4MB by the Microsoft Graph API. For larger files, an "upload session" (`createUploadSession`) would be required but is not yet implemented.
- **Delta Sync**: While `deltaLink` is present in the configuration, the current file system implementation primarily uses standard listing (`walk`) rather than the Graph API's delta sync capability.
- **Business Accounts**: Personal OneDrive accounts are fully supported. Some configurations of OneDrive for Business or SharePoint might have different behavior or restrictions.
