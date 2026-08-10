# implementation of Queue and Stack in TypeScript/JavaScript

## idea

Inspired from [this](https://stackoverflow.com/questions/1590247/how-do-you-implement-a-stack-and-a-queue-in-javascript).

An array is a stack in js. But `Array.prototype.shift()` is **NOT** an O(1) operation. So a queue should be implemented using two stacks to get amortized O(1) `pop` time.

## install

```bash
npm i @fyears/tsqueue
```

## usage

```typescript
import { Queue } from '@fyears/tsqueue';

const q = new Queue<string>();

q.push('abc');
q.push('efg');

const xx = q.pop();
console.log(xx); // abc

console.log(q.length); // 1

q.pop();
console.log(q.length); // 0

const xx2 = q.pop();
console.log(xx2); // undefined
```
