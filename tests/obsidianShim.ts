import moment from "moment";
import Module from "module";
import dns from "node:dns";

// Prefer IPv4 to avoid timeouts on broken IPv6 networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

// Mocking Obsidian APIs for Node.js environment
const obsidianMock = {
  moment,
  requestUrl: async (request: any) => {
    const url = typeof request === "string" ? request : request.url;
    const options: RequestInit = {
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body,
    };

    const response = await fetch(url, options);

    if (request.throw !== false && !response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    let json = {};
    try { json = JSON.parse(text); } catch (e) {}

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      arrayBuffer: buffer,
      json: json,
      text: text,
    };
  },
  Platform: {
    isAndroidApp: false,
    isIosApp: false,
    isMacOS: false,
    isMobile: false,
    isSafari: false,
  },
  Notice: class Notice {
    constructor(message: string) {
      console.log(`[Obsidian Notice] ${message}`);
    }
  },
  Plugin: class Plugin {},
  Modal: class Modal {
    constructor(app: any) {}
    open() {}
    close() {}
  },
  Setting: class Setting {
    constructor(containerEl: HTMLElement) {}
    setName(name: string) { return this; }
    setDesc(desc: string) { return this; }
    addText(cb: any) { return this; }
    addButton(cb: any) { return this; }
    addDropdown(cb: any) { return this; }
    addToggle(cb: any) { return this; }
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

// @ts-ignore
const originalLoad = Module._load;
// @ts-ignore
Module._load = function(request, parent, isMain) {
  if (request === "obsidian") {
    return obsidianMock;
  }
  return originalLoad.apply(this, arguments);
};

export default obsidianMock;
