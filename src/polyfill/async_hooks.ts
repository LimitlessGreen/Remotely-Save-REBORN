export class AsyncResource {
  constructor(type: string, triggerAsyncId?: number | object) {}
  runInAsyncScope(fn: Function, thisArg?: any, ...args: any[]) {
    return fn.apply(thisArg, args);
  }
  emitDestroy() {}
  asyncId() { return 0; }
  triggerAsyncId() { return 0; }
}

export default { AsyncResource };
