// @ts-ignore
import axios from '../../node_modules/axios/index.js';
import obsidianAdapter from './axios-obsidian-adapter';

if (axios && axios.defaults) {
  // @ts-ignore
  axios.defaults.adapter = obsidianAdapter;
}

export default axios;
