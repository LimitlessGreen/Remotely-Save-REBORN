import { Buffer } from "buffer";
import process from "process";

if (!process.versions) {
  process.versions = {};
}
if (!process.versions.node) {
  process.versions.node = "18.0.0";
}

export { Buffer, process };
