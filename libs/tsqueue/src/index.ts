
export class Stack<T> {
  readonly stackBack: T[];
  length: number;
  constructor(x?: T[]) {
    if (x === undefined) {
      this.stackBack = [];
      this.length = 0;
    }
    else {
      this.stackBack = [...x];
      this.length = this.stackBack.length;
    }
  }
  push(x: T) {
    this.stackBack.push(x);
    this.length += 1;
  }
  pop(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    this.length -= 1;
    return this.stackBack.pop();
  }
  size(): number {
    return this.length;
  }
  /**
   * access the newest element but do not pop it
   */
  back(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    return this.stackBack[this.stackBack.length - 1];
  }
}

export class Queue<T> {
  readonly stackBack: T[];
  readonly stackFront: T[];
  length: number;
  constructor(x?: T[]) {
    if (x === undefined) {
      this.stackBack = [];
      this.stackFront = [];
      this.length = 0;
    } else {
      // save pop, directly insert into stackFront one by one
      this.stackFront = [];
      for (let i = x.length - 1; i >= 0; i--) {
        this.stackFront.push(x[i]);
      }
      this.stackBack = [];
      this.length = this.stackFront.length;
    }
  }

  push(x: T) {
    this.stackBack.push(x);
    this.length += 1;
  }

  pop(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    if (this.stackFront.length === 0) {
      while (this.stackBack.length > 0) {
        this.stackFront.push(this.stackBack.pop() as T);
      }
    }
    this.length -= 1;
    return this.stackFront.pop();
  }

  shift(): T | undefined {
    return this.pop();
  }

  size(): number {
    return this.length;
  }

  /**
   * access the oldest element in queue but do not pop it
   */
  front(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    if (this.stackFront.length === 0) {
      while (this.stackBack.length > 0) {
        this.stackFront.push(this.stackBack.pop() as T);
      }
    }
    return this.stackFront[this.stackFront.length - 1];
  }

  /**
   * access the newest element in queue
   */
  back(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    if (this.stackBack.length > 0) {
      return this.stackBack[this.stackBack.length - 1];
    }
    return this.stackFront[0];
  }
}
