// Generic object pool
export type ResetFn<T> = (obj: T) => void;
export default class Pool<T> {
  private stack: T[] = [];
  private factory: () => T;
  private reset?: ResetFn<T>;
  public created = 0;

  constructor(factory: () => T, reset?: ResetFn<T>, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) this.stack.push(this.factory());
    this.created = this.stack.length;
  }

  acquire(): T {
    const obj = this.stack.pop() || this.factory();
    if (!this.stack.includes(obj)) this.created++;
    return obj;
  }

  release(obj: T): void {
    if (this.reset) this.reset(obj);
    this.stack.push(obj);
  }

  size(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack.length = 0;
  }
}
