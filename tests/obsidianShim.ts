import dns from "node:dns";
import Module from "module";
import moment from "moment";

// Prefer IPv4 to avoid timeouts on broken IPv6 networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

// Mocking Obsidian APIs for Node.js environment
const obsidianMock = {
  moment,
  requestUrl: async (
    request:
      | string
      | {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string | ArrayBuffer;
          throw?: boolean;
        }
  ) => {
    const url = typeof request === "string" ? request : request.url;
    const options: RequestInit = {
      method: (typeof request === "string" ? "GET" : request.method) || "GET",
      headers: (typeof request === "string" ? {} : request.headers) || {},
      body: typeof request === "string" ? undefined : (request.body as any),
    };

    const response = await fetch(url, options);

    if (
      typeof request !== "string" &&
      request.throw !== false &&
      !response.ok
    ) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch (_e) {}

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      arrayBuffer: buffer,
      json: json,
      text: text,
    };
  },
  platform: {
    isAndroidApp: false,
    isIosApp: false,
    isMacOS: false,
    isMobile: false,
    isSafari: false,
  },
  notice: class Notice {
    constructor(message: string) {
      console.log(`[Obsidian Notice] ${message}`);
    }
  },
  plugin: class Plugin {},
  modal: class Modal {
    open() {}
    close() {}
  },
  setting: class Setting {
    setName(_name: string) {
      return this;
    }
    setDesc(_desc: string) {
      return this;
    }
    addText(_cb: (component: unknown) => unknown) {
      return this;
    }
    addButton(_cb: (component: unknown) => unknown) {
      return this;
    }
    addDropdown(_cb: (component: unknown) => unknown) {
      return this;
    }
    addToggle(_cb: (component: unknown) => unknown) {
      return this;
    }
  },
  requireApiVersion: (version: string) => {
    // Disable the Obsidian requestUrl patch for WebDAV integration tests
    // so it uses the standard node-webdav request mechanism.
    if (version === "0.13.26") return false;
    return true;
  },
  addIcon: () => {},
  setIcon: () => {},
};

// @ts-expect-error
const originalLoad = Module._load;
// @ts-expect-error
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    return obsidianMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};

export default obsidianMock;
