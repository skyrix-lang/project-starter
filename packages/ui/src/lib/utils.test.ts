import { expect, it } from "vitest";
import { cn } from "./utils";

it("keeps a text colour next to a theme type utility", () => {
  expect(cn("bg-card text-card-foreground p-6", "text-h2")).toBe(
    "bg-card text-card-foreground p-6 text-h2",
  );
  expect(cn("text-lead", "text-primary")).toBe("text-lead text-primary");
});

it("lets a later size replace an earlier one", () => {
  expect(cn("text-sm", "text-h3")).toBe("text-h3");
  expect(cn("text-h1", "text-display")).toBe("text-display");
});
