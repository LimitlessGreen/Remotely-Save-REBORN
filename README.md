# Remotely Save (Community Fork)

**This is a community-maintained fork of the original Remotely Save plugin.** The original project is currently inactive, and this fork aims to continue development and maintenance under a fully open-source model.

[![BuildCI](https://github.com/remotely-save/remotely-save/actions/workflows/auto-build.yml/badge.svg)](https://github.com/remotely-save/remotely-save/actions/workflows/auto-build.yml)

## Disclaimer

- **This is NOT the [official sync service](https://obsidian.md/sync) provided by Obsidian.**
- This fork is not affiliated with the original author.

## !!!Caution!!!

**ALWAYS, ALWAYS, backup your vault before using this plugin.**

## Features

- Supports:
  - Amazon S3 or S3-compatible (Cloudflare R2 / BackBlaze B2 / MinIO / ...)
  - Dropbox
  - OneDrive for personal (App Folder)
  - Webdav (NextCloud / InfiniCloud / Synology webdav server / ...)
  - Webdis
- **Obsidian Mobile supported.** Vaults can be synced across mobile and desktop devices with the cloud service as the "broker".
- **[End-to-end encryption](./docs/encryption/README.md) supported.** Files would be encrypted using openssl / rclone crypt format before being sent to the cloud **if** user specify a password.
- **Scheduled auto sync supported.**
- **[Minimal Intrusive](./docs/minimal_intrusive_design.md).**
- **Skip Large files** and **skip paths** by custom regex conditions!
- **[Sync Algorithm](./docs/sync_algorithm/v3/intro.md) is provided for discussion.**
- **Basic Conflict Detection And Handling.**
- Fully Open Source (Apache 2.0). See [License](./LICENSE) for details.

> [!NOTE]
> The original "PRO" features (Google Drive, Box, pCloud, etc.) were part of a proprietary module and have been removed in this fork to ensure a clean open-source codebase. We aim to reimplement these as open-source features in the future.

## Limitations

- **Cloud services cost you money.**
- **Some limitations from the browser environment.** More technical details are [in the doc](./docs/browser_env.md).
- **You should protect your `data.json` file.**
- **Obsidian API on Mobile has performance issues syncing large files (>= 50 MB).**

## Questions, Suggestions, Or Bugs

Please use the issue tracker and discussions on this fork's repository.

## Usage

Please refer to the documentation in the `docs` folder for setup instructions for various services.

## Licensing

Licensed under the Apache License, version 2.0. See [LICENSE](./LICENSE) for more information.
