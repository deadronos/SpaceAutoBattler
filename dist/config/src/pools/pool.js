export default class Pool {
    stack = [];
    factory;
    reset;
    created = 0;
    constructor(factory, reset, initialSize = 0) {
        this.factory = factory;
        this.reset = reset;
        for (let i = 0; i < initialSize; i++)
            this.stack.push(this.factory());
        this.created = this.stack.length;
    }
    acquire() {
        const obj = this.stack.pop();
        if (typeof obj !== "undefined")
            return obj;
        const newObj = this.factory();
        this.created++;
        return newObj;
    }
    release(obj) {
        if (this.reset)
            this.reset(obj);
        // Avoid pushing the same object twice which can lead to duplicate
        // references in the pool and subtle reuse bugs.
        if (!this.stack.includes(obj))
            this.stack.push(obj);
    }
    size() {
        return this.stack.length;
    }
    clear() {
        this.stack.length = 0;
    }
}
