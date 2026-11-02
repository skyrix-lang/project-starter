// Wraps the page in a Suspense boundary, so the HTML starts with this skeleton
// and JavaScript swaps in the page once the database has answered. Without
// JavaScript the skeleton stays on screen: remove this file if a route has to
// work without it.
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading bookings">
      <div className="h-14 w-64 rounded-md bg-surface-200 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-52 rounded-lg bg-surface-200 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
