import "dotenv/config";

export const testConfig = {
  s3: {
    endpoint: process.env.TEST_S3_ENDPOINT || "",
    region: process.env.TEST_S3_REGION || "us-east-1",
    accessKeyID: process.env.TEST_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.TEST_S3_SECRET_ACCESS_KEY || "",
    bucketName: process.env.TEST_S3_BUCKET_NAME || "",
    remotePrefix: process.env.TEST_S3_REMOTE_PREFIX || "rs-test",
  },
  dropbox: {
    token: process.env.TEST_DROPBOX_TOKEN || "",
    remoteBaseDir: process.env.TEST_DROPBOX_REMOTE_BASE_DIR || "rs-test",
  },
  webdav: {
    address: process.env.TEST_WEBDAV_ADDRESS || "",
    username: process.env.TEST_WEBDAV_USERNAME || "",
    password: process.env.TEST_WEBDAV_PASSWORD || "",
  }
};

export const isS3Configured = !!(testConfig.s3.endpoint && testConfig.s3.accessKeyID && testConfig.s3.bucketName);
export const isDropboxConfigured = !!(testConfig.dropbox.token);
export const isWebdavConfigured = !!(testConfig.webdav.address);
