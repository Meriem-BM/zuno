// Each agent's index.ts is a top-level await on `client.listen(...)`,
// which never resolves. Sequential imports would block on the first one;
// parallel dynamic imports run all four listeners concurrently inside one
// Node process. Dev convenience only; production runs each in its own
// terminal via the per-agent `start:*` scripts.
await Promise.all([
  import("./scout/index.js"),
  import("./strategist/index.js"),
  import("./critic/index.js"),
  import("./arbiter/index.js"),
]);

export {};
