/**
 * A minimal async mutex: callbacks run one at a time, in call order.
 *
 * Used so that "write the local row and queue the change" and "merge a remote
 * row into the local table" never interleave. Without it, a remote row could
 * overwrite a local edit in the gap between the edit and its queue entry.
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    // A failing task must not poison the chain for the next one.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
