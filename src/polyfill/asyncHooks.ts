export class AsyncResource {
  runInAsyncScope(fn: (...args: any[]) => any, thisArg?: any, ...args: any[]) {
    return fn.apply(thisArg, args);
  }
  emitDestroy() {}
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
}

export default { asyncResource: AsyncResource };
