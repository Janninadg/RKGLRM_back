class SocketRequestLockManager {
  constructor() {
    this.locks = new Map();
    this.timeouts = new Map();
    this.defaultTtlMs = 15000;
  }

  acquire(key, meta = {}, ttlMs = this.defaultTtlMs) {
    if (this.locks.has(key)) return false;

    this.locks.set(key, {
      key,
      ...meta,
      createdAt: new Date()
    });

    const timeout = setTimeout(() => {
      this.release(key, true);
    }, ttlMs);

    this.timeouts.set(key, timeout);
    return true;
  }

  release(key, expired = false) {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }

    const info = this.locks.get(key);
    this.locks.delete(key);

    return { info, expired };
  }

  getLocks() {
    return Array.from(this.locks.values());
  }
}

const socketLockManager = new SocketRequestLockManager();
export default socketLockManager;