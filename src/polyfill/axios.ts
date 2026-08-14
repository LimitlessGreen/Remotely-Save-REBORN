import axios from "../../node_modules/axios/index.js";
import obsidianAdapter from "./axiosObsidianAdapter";

if (axios?.defaults) {
  // @ts-expect-error
  axios.defaults.adapter = obsidianAdapter;
}

export default axios;
