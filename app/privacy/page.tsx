import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Press",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 prose dark:prose-invert">
      <h1>Privacy</h1>
      <h2>Data we collect</h2>
      <p>
        Press collects nothing. PDF files you upload are processed entirely
        within your browser using a WebAssembly build of the pdfcpu library. No
        file content is transmitted to any server. No file content is stored
        anywhere. When you close the browser tab, all data is gone.
      </p>
      <h2>Cookies</h2>
      <p>
        Press does not set any cookies. Your CDN provider (e.g. Cloudflare) may
        set short-lived security cookies as part of standard network delivery.
        These contain no file content.
      </p>
      <h2>Analytics</h2>
      <p>
        None. Press does not include analytics, tracking pixels, or telemetry.
      </p>
      <h2>localStorage and URL state</h2>
      <p>
        Press may store your selected operation and its configuration options in
        the URL hash for sharing. File content is never included in the URL
        hash. The app does not use localStorage to persist data between
        sessions.
      </p>
      <h2>Third-party services</h2>
      <p>
        PDF processing is performed by pdfcpu (Apache 2.0, by Horst Rutter),
        compiled to WebAssembly and running locally in your browser. pdfcpu does
        not make network requests.
      </p>
      <h2>Contact</h2>
      <p>
        For questions about this privacy notice, contact{" "}
        <a href="mailto:hi@chaitanyaprabuddha.com">hi@chaitanyaprabuddha.com</a>
        .
      </p>
      <p className="text-sm text-gray-500">Last updated: May 18, 2026</p>
      <p>
        <Link href="/">← Home</Link>
      </p>
    </div>
  );
}
