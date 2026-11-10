import { writeFileSync } from "node:fs";
import { openApiDocument } from "../src/routes/api";

// Writes the API's OpenAPI document, which packages/api generates the client,
// types and mocks from. `yarn api:generate` runs it.
const out = process.argv[2] ?? "../../packages/api/openapi.json";
writeFileSync(out, `${JSON.stringify(openApiDocument(), null, 2)}\n`);
console.log(`Wrote ${out}`);
