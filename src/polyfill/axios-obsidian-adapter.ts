import { requestUrl, type RequestUrlParam } from "obsidian";

export default async function obsidianAdapter(config: any) {
  return new Promise((resolve, reject) => {
    const url = config.url.startsWith('http') ? config.url : (config.baseURL + config.url);

    const params: RequestUrlParam = {
      url: url,
      method: config.method.toUpperCase(),
      headers: config.headers,
      body: config.data,
      throw: false
    };

    if (config.params) {
      const query = new URLSearchParams(config.params).toString();
      params.url += (params.url.includes('?') ? '&' : '?') + query;
    }

    requestUrl(params)
      .then((response) => {
        const axiosResponse = {
          data: response.json || response.text || response.arrayBuffer,
          status: response.status,
          statusText: "", // Obsidian doesn't provide this easily
          headers: response.headers,
          config: config,
          request: null
        };
        if (response.status >= 200 && response.status < 300) {
          resolve(axiosResponse);
        } else {
          reject(new Error(`Request failed with status code ${response.status}`));
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}
