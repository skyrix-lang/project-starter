"use client";

import { useEffect } from "react";

// Replaces the root layout when it fails, so it can't rely on the layout's
// fonts or stylesheet.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "5rem 1rem",
        }}
      >
        <title>Something went wrong</title>
        <h1>Something went wrong</h1>
        <p>Please try again.</p>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
