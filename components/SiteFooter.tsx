import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 py-6 px-4 text-sm text-gray-600 dark:text-gray-400">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <p>© 2026 Chaitanya Prabuddha — MIT License</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/privacy/" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms/" className="hover:underline">
            Terms
          </Link>
          <Link href="/credits/" className="hover:underline">
            Credits
          </Link>
        </nav>
      </div>
    </footer>
  );
}
