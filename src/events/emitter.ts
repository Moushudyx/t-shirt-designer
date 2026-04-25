/**
 * 事件处理函数类型
 */
type Handler<T> = (payload: T) => void;

/**
 * 轻量事件总线
 */
export class Emitter<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, Set<Handler<any>>>();

  /**
   * 订阅事件
   */
  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
  }

  /**
   * 取消订阅事件
   */
  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * 触发事件
   */
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  /**
   * 清空全部监听器
   */
  clear(): void {
    this.listeners.clear();
  }
}
