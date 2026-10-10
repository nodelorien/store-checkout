import type { Middleware } from '@reduxjs/toolkit';

/** Test middleware that records every action reaching the store, serialised. */
export function createActionRecorder() {
  const actions: string[] = [];
  const middleware: Middleware = () => (next) => (action) => {
    actions.push(JSON.stringify(action));
    return next(action);
  };

  return { middleware, actions, types: () => actions.map((a) => JSON.parse(a).type as string) };
}
