export function Footer() {
  // A Server Component: the year is read once per render on the server, and the
  // root layout revalidates daily to keep it current.
  // oxlint-disable-next-line react/purity
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-surface-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-surface-500">
            &copy; {year} BookingHub. All rights reserved.
          </p>
          {/* Placeholders: point these at real pages before launch. */}
          {/* oxlint-disable jsx-a11y/anchor-is-valid */}
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-surface-500 hover:text-surface-700 transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-surface-500 hover:text-surface-700 transition-colors"
            >
              Terms
            </a>
          </div>
          {/* oxlint-enable jsx-a11y/anchor-is-valid */}
        </div>
      </div>
    </footer>
  );
}
