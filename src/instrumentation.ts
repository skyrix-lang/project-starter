// Runs once when a server starts, before it handles any request. Next.js also
// compiles this for the Edge runtime, so Node-only code lives in its own module,
// imported only under the Node.js runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
