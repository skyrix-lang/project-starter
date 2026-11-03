import type { Metadata } from "next";
import Link from "next/link";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false },
};

export default function CheckEmailPage() {
  return (
    <div className="max-w-sm mx-auto py-8">
      <Card className="space-y-4 text-center">
        <EnvelopeIcon className="h-12 w-12 text-primary-600 mx-auto" />
        <h1 className="text-2xl font-bold text-surface-900">
          Check your email
        </h1>
        <p className="text-sm text-surface-500">
          We sent you a sign-in link. It works once and expires in 24 hours.
        </p>
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>
          Back to home
        </Link>
      </Card>
    </div>
  );
}
