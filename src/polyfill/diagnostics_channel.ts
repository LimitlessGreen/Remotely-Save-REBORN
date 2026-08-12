const noop = () => {};
const channel = () => ({
  subscribe: noop,
  unsubscribe: noop,
  publish: noop,
  hasSubscribers: false,
});

export { channel };
export default { channel };
