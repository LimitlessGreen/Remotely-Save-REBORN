import obsidianMock from "./obsidianShim";
import { strict as assert } from "assert";
import obsidianAdapter from "../src/polyfill/axios-obsidian-adapter";

describe("Axios Obsidian Adapter", () => {
  const originalRequestUrl = obsidianMock.requestUrl;

  afterEach(() => {
    obsidianMock.requestUrl = originalRequestUrl;
  });

  it("should map simple GET request", async () => {
    obsidianMock.requestUrl = async (params: any) => {
      assert.equal(params.method, "GET");
      assert.ok(params.url.includes("foo=bar"));
      return {
        status: 200,
        json: { success: true },
        headers: { "content-type": "application/json" },
        text: JSON.stringify({ success: true }),
        arrayBuffer: new ArrayBuffer(0)
      };
    };

    const config = {
      method: "get",
      url: "https://example.com/get",
      headers: { "X-Test": "test" },
      params: { foo: "bar" }
    };

    const response: any = await obsidianAdapter(config);

    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { success: true });
    assert.equal(response.config, config);
  });

  it("should handle absolute URLs with baseURL", async () => {
    obsidianMock.requestUrl = async (params: any) => {
      assert.equal(params.url, "https://example.com/post");
      return {
        status: 200,
        text: "OK",
        headers: {},
        json: null,
        arrayBuffer: new ArrayBuffer(0)
      };
    };

    const config = {
      method: "post",
      baseURL: "https://example.com",
      url: "/post",
      data: JSON.stringify({ hello: "world" }),
      headers: { "Content-Type": "application/json" }
    };

    const response: any = await obsidianAdapter(config);

    assert.equal(response.status, 200);
    assert.equal(response.data, "OK");
  });
});

