import * as chai from "chai";
import { Queue, Stack } from "../src";
const expect = chai.expect;

describe("basic Queue tests", () => {

  it("should allow basic queue operations", async () => {
    const k = new Queue<string>();
    k.push('abc');
    k.push('efg');
    expect(k.length).equals(2);
    const xx = k.pop();
    expect(xx).equals('abc');
    expect(k.length).equals(1);
    k.pop();
    expect(k.length).equals(0);
    const xx2 = k.pop();
    expect(xx2).to.be.undefined;
    expect(k.length).equals(0);
  });


  it("should allow array init", async () => {
    const k = new Queue(['abc','def','ghi','jkl']);
    expect(k.length).equals(4);
    const xx = k.pop();
    expect(xx).equals('abc'); // FIFO
    expect(k.length).equals(3);
    k.push('mno');
    expect(k.back()).equals('mno');
    expect(k.front()).equals('def');
    expect(k.length).equals(4);
  });
});


describe("basic Stack tests", () => {

  it("should allow basic stack operations", async () => {
    const k = new Stack<string>();
    k.push('abc');
    k.push('efg');
    expect(k.length).equals(2);
    const xx = k.pop();
    expect(xx).equals('efg');
    expect(k.length).equals(1);
    k.pop();
    expect(k.length).equals(0);
    const xx2 = k.pop();
    expect(xx2).to.be.undefined;
    expect(k.length).equals(0);
  });


  it("should allow array init", async () => {
    const k = new Stack(['abc','def','ghi','jkl']);
    expect(k.length).equals(4);
    const xx = k.pop();
    expect(xx).equals('jkl'); // FIFO
    expect(k.length).equals(3);
    k.push('mno');
    expect(k.back()).equals('mno');
    expect(k.length).equals(4);
  });
});
