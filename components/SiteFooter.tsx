import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-3 px-4 text-sm text-neutral-500 sm:flex-row sm:gap-6">
        <Link href="/privacy/" className="hover:text-neutral-900 hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms/" className="hover:text-neutral-900 hover:underline">
          Terms &amp; Conditions
        </Link>
      </div>
    </footer>
  );
}
