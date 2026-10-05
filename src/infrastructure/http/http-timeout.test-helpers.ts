/** Mock fetch qui respecte `init.signal` — prouve l’annulation réelle. */

export function rejectWhenAborted(
  signal: AbortSignal | null | undefined,
): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => {
      reject(
        signal?.reason ??
          new DOMException("The operation was aborted.", "AbortError"),
      );
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function hangingFetch(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return rejectWhenAborted(init?.signal) as Promise<Response>;
}

export function headersThenHangingBody(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    json: () => rejectWhenAborted(init?.signal),
    text: () => rejectWhenAborted(init?.signal),
  } as unknown as Response);
}
