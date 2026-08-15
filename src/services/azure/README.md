# Azure Blob Storage Service

## Overview
The Azure Blob Storage service implementation provides connectivity to Microsoft Azure's object storage. It uses the `@azure/storage-blob` SDK to manage blobs and containers. The implementation follows the "flat" nature of blob storage, using virtual directories.

## API Documentation
- [Azure Blob Storage REST API Reference](https://learn.microsoft.com/en-us/rest/api/storageservices/blob-service-rest-api)
- [Azure Storage Blob Client Library for JavaScript](https://learn.microsoft.com/en-us/javascript/api/overview/azure/storage-blob-readme)

## Authentication
Authentication is handled via a **Container SAS (Shared Access Signature) URL**:
- The SAS URL should provide access to the specific container.
- It must include permissions for **Read**, **Write**, **Delete**, and **List**.
- Users must also specify the **Container Name**.

## Implementation Details & Gotchas
- **CORS Configuration**: Since Obsidian runs in a browser-like environment, the Azure Storage account must be configured with a CORS rule to allow `GET`, `PUT`, `DELETE`, `HEAD`, and `POST` methods from the appropriate origins (or `*`).
- **Metadata**:
    - The implementation stores the file's last modified time (`mtime`) in the blob's metadata using the key `mtime` (ISO 8601 format).
    - Note that Azure metadata keys are treated as case-insensitive but stored as provided.
- **Flat Listing**: `listBlobsFlat` is used to retrieve all blobs under a specific prefix. This is efficient for large-scale operations but does not natively return a hierarchical view.
- **Virtual Folders**: Directories are virtual. `mkdir` does not create a physical object but ensures the service logic recognizes the path.
- **SAS Token Expiration**: The SAS URL contains an expiration date. Once expired, the connection will fail until a new SAS URL is provided.

## Known Limitations
- **Stat Efficiency**: The current `stat` implementation performs a flat listing of blobs under the path's prefix and searches for the exact match, which can be slow for containers with many blobs.
- **Large File Optimization**: While the SDK handles block-based uploads, this implementation uses a simple `upload` call which may be less efficient for extremely large files compared to manual block management.
- **Versioning**: Azure Blob Storage versioning is not currently supported by this provider.
