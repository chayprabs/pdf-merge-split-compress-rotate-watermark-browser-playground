import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Press",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-neutral-700">
      <h1 className="text-2xl font-semibold text-neutral-900">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-relaxed">
        Last updated: May 29, 2026
      </p>

      <h2 className="mt-8 text-lg font-medium text-neutral-900">Data we collect</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Press collects nothing. PDF files you upload are processed entirely within
        your browser using a WebAssembly build of the pdfcpu library. No file
        content is transmitted to any server. No file content is stored anywhere.
        When you close the browser tab, all data is gone.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Cookies</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Press does not set any cookies. Your CDN provider (e.g. Cloudflare) may
        set short-lived security cookies as part of standard network delivery.
        These contain no file content.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Analytics</h2>
      <p className="mt-2 text-sm leading-relaxed">
        None. Press does not include analytics, tracking pixels, or telemetry.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">URL state</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Press may store your selected operation and its configuration options in
        the URL hash for sharing. File content is never included in the URL hash.
        The app does not use localStorage to persist data between sessions.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Third-party services</h2>
      <p className="mt-2 text-sm leading-relaxed">
        PDF processing is performed by pdfcpu (Apache 2.0), compiled to WebAssembly
        and running locally in your browser. pdfcpu does not make network requests.
        Static hosting may be provided by Cloudflare Pages or similar services that
        deliver files without accessing their contents.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Contact</h2>
      <p className="mt-2 text-sm leading-relaxed">
        For questions about this privacy notice, contact{" "}
        <a href="mailto:hi@chaitanyaprabuddha.com" className="text-neutral-900 underline">
          hi@chaitanyaprabuddha.com
        </a>
        .
      </p>

      <p className="mt-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Back to Press
        </Link>
      </p>
    </div>
  );
}
