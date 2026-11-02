import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold text-surface-900">Page not found</h1>
      <p className="mt-2 text-surface-500">
        The page you are looking for does not exist.
      </p>
      <Link href="/" className={`mt-6 ${buttonStyles()}`}>
        Back to home
      </Link>
    </div>
  );
}
