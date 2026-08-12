import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Everything under test is Node: the Express layer and the pure functions the
    // pipeline and the pages share. React components are not covered here.
    environment: "node",

    include: ["server/**/*.test.ts", "src/lib/**/*.test.ts"],

    // No global `describe`/`it`. They are imported explicitly, which keeps
    // `tsc --noEmit` honest without adding vitest's ambient types to the app's
    // own type checking.
    globals: false,

    // The SSE tests open real sockets on ephemeral ports, so files must not share
    // a process — a stray listener from one file would otherwise be visible to
    // the next.
    isolate: true,
  },
});
