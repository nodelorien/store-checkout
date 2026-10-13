/**
 * A response the test releases by hand. A handler awaits `opened`; the test asserts the pending
 * state and then calls `open()`. Unlike a fixed delay, it cannot lose the race on a slow runner.
 */
export function createGate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open: () => open() };
}
