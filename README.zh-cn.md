# Remotely Save (社区分支版)

[English](./README.md) | 中文

**这是原 Remotely Save 插件的一个由社区维护的分支 (Fork)。** 原项目目前已停止维护，本分支旨在以完全开源的模式继续开发和维护该插件。

[![BuildCI](https://github.com/remotely-save/remotely-save/actions/workflows/auto-build.yml/badge.svg)](https://github.com/remotely-save/remotely-save/actions/workflows/auto-build.yml)

## 免责声明

- **这不是 Obsidian 提供的[官方同步服务](https://obsidian.md/sync)。**
- 本分支与原作者无关。

## !!!警告!!!

**在使用此插件之前，一定，一定要记得备份你的 vault。**

## 功能

- 支持：
  - Amazon S3 或兼容 S3 的服务（Cloudflare R2 / BackBlaze B2 / MinIO / ...）
  - Dropbox
  - 个人版本 OneDrive（应用文件夹）
  - Webdav（NextCloud / InfiniCloud / Synology webdav 服务器 / ...）
  - Webdis
- **支持 Obsidian 移动版。**
- **支持[端到端加密](./docs/encryption/README.md)。**
- **支持计划自动同步。**
- **[最小侵入性](./docs/minimal_intrusive_design.md)。**
- 通过自定义正则表达式条件**跳过大文件和路径！**
- **[同步算法](./docs/sync_algorithm/v3/intro.md)文档公开。**
- **基本冲突检测和处理。**
- 完全开源 (Apache 2.0)。详见[许可证](./LICENSE)。

> [!NOTE]
> 原版中的 "PRO" 功能（Google Drive, Box, pCloud 等）属于私有模块，已在本分支中移除以确保代码库的纯粹开源性。我们计划在未来以开源形式重新实现这些功能。

## 限制

- **云服务会产生费用。**
- **来自浏览器环境的一些限制。**
- **记得保护你的 `data.json` 文件。**
- **Obsidian 移动版 API 在同步大文件（>= 50 MB）时存在性能问题。**

## 问题、建议或错误

请在本分支仓库的 Issue 和 Discussion 中提交。

## 许可证

基于 Apache License, version 2.0 授权。详见 [LICENSE](./LICENSE)。
