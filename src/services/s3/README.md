# S3 Cloud Storage Service

## Overview
The S3 service implementation provides compatibility with Amazon S3 and S3-compatible APIs (like MinIO, Cloudflare R2, Backblaze B2, etc.). It uses the AWS SDK for JavaScript v3 and is designed to handle the flat object structure of S3 by either synthesizing folder entities from object keys or creating explicit folder objects.

## API Documentation
- [Amazon S3 REST API Reference](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)
- [AWS SDK for JavaScript v3 - S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)

## Authentication
Authentication is handled via **Static Credentials**:
- **Access Key ID**
- **Secret Access Key**
- **Region**: Required for AWS S3 and some providers.
- **Endpoint**: Custom endpoints are supported for S3-compatible services.

## Implementation Details & Gotchas
- **CORS (Cross-Origin Resource Sharing)**: Browser-based environments like Obsidian often face CORS restrictions when hitting S3 endpoints directly.
    - An `ObsHttpHandler` is implemented to use Obsidian's `requestUrl` API, which bypasses CORS.
    - This can be toggled via the `bypassCorsLocally` setting.
- **URL Styles**: Supports both **Virtual Hosted-Style** (`bucket.s3.amazonaws.com`) and **Path-Style** (`s3.amazonaws.com/bucket`).
- **Multipart Uploads**: Larger files are automatically handled using the `@aws-sdk/lib-storage` `Upload` utility.
    - Default part size: 5MB.
    - Concurrency is configurable via `partsConcurrency`.
- **Last Modified Time (mtime)**:
    - S3's `LastModified` is set by the server and cannot be modified by the client.
    - To preserve local file timestamps, this implementation stores `mtime` and `ctime` in the object's **Metadata** (`mtime` or `MTime` keys).
    - If `useAccurateMTime` is enabled, a `HEAD` request is performed for each object during a listing to retrieve this metadata.
- **Folders**:
    - By default, folders are synthesized from object keys (e.g., `folder/file.txt` implies a folder named `folder`).
    - If `generateFolderObject` is enabled, the service will create 0-byte objects for directories.
- **Path Separators**: Always uses `/` as per S3 object key conventions.

## Known Limitations
- **Performance**: Enabling `useAccurateMTime` significantly slows down directory listings because it requires one `HEAD` request per file to fetch metadata.
- **Versioning**: Basic support for listing and retrieving specific versions is implemented, but advanced version management is not exposed.
- **List Consistency**: S3-compatible providers may have varying levels of consistency for `ListObjectsV2`.
