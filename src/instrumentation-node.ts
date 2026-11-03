import { env } from "@/lib/env";

// `next build` has no runtime environment to check.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    env();
  } catch (error) {
    // Next.js logs an error thrown during startup but keeps serving, so a bad
    // deploy would look healthy. Exit instead, so it fails where it's deployed.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
