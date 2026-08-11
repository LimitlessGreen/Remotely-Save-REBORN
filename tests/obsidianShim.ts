import moment from "moment";
import Module from "module";

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

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      arrayBuffer: await response.arrayBuffer(),
      json: async () => await response.json(),
      text: async () => await response.text(),
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
  requireApiVersion: (version: string) => true,
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
