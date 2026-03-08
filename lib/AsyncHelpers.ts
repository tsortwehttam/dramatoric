export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((res) => setTimeout(res, ms));
  if (signal.aborted) return Promise.resolve();
  return new Promise((res) => {
    let timeout: NodeJS.Timeout;
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      res();
    };
    const onDone = () => {
      signal.removeEventListener("abort", onAbort);
      res();
    };
    timeout = setTimeout(onDone, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function dynamicTimer(fn: (i: number) => Promise<number>, i: number = 0) {
  const ms = await fn(i);
  setTimeout(() => {
    dynamicTimer(fn, i + 1);
  }, ms);
}

export async function parallel<T, R>(items: T[], iteratee: (item: T, index: number) => Promise<R>): Promise<R[]> {
  return Promise.all(items.map(iteratee));
}

export async function asyncMap<T, R>(items: T[], iteratee: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await iteratee(items[i], i));
  }
  return results;
}

export async function asyncForEach<T>(items: T[], iteratee: (item: T, index: number) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await iteratee(items[i], i);
  }
}

export async function poll<T>(
  fn: () => Promise<T>,
  validate: (res: T) => boolean,
  interval: number,
  timeout: number
): Promise<T> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (validate(result)) {
      return result;
    }
    await sleep(interval);
  }
  throw new Error("Polling timed out");
}
