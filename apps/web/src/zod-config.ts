import { z } from "zod";

// the csp (apps/bff/src/app.ts) has no 'unsafe-eval', so zod's faster
// validators, compiled with `new Function`, can't run here. without this,
// zod still tries once to find out, and firefox reports the refusal as a
// console error. it must run before any schema is made: main.tsx imports it
// first, and vite.config.ts bundles it with zod itself.
z.config({ jitless: true });
