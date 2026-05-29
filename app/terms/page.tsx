import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — Press",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-neutral-700">
      <h1 className="text-2xl font-semibold text-neutral-900">Terms &amp; Conditions</h1>
      <p className="mt-4 text-sm leading-relaxed">
        Last updated: May 29, 2026
      </p>

      <h2 className="mt-8 text-lg font-medium text-neutral-900">Acceptance</h2>
      <p className="mt-2 text-sm leading-relaxed">
        By using Press, you agree to these terms. If you do not agree, do not use
        the service.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">As-is service</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Press is provided free of charge and &quot;as is&quot;, without warranty of any
        kind, express or implied, under the MIT License. The operator disclaims all
        warranties including merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">No warranty on output</h2>
      <p className="mt-2 text-sm leading-relaxed">
        PDF processing is performed by pdfcpu. The operator makes no warranty that
        processed PDFs are accurate, complete, or free of errors. Always verify
        output before relying on it for legal, financial, medical, or other
        important purposes.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Limitation of liability</h2>
      <p className="mt-2 text-sm leading-relaxed">
        To the fullest extent permitted by law, the operator shall not be liable for
        any direct, indirect, incidental, special, consequential, or punitive
        damages arising from your use of Press, including but not limited to loss of
        data, loss of profits, business interruption, or any damages resulting from
        processed PDF output. You use Press entirely at your own risk.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Acceptable use</h2>
      <p className="mt-2 text-sm leading-relaxed">
        You may not use Press to process files in a manner that violates applicable
        laws. You are solely responsible for having the legal right to process the
        PDF files you use with this tool.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Sensitive documents</h2>
      <p className="mt-2 text-sm leading-relaxed">
        While PDF files are processed locally and never transmitted to our servers,
        browser memory may be accessible to other extensions or scripts in the same
        browser profile. Use a dedicated browser profile or private window when
        processing highly sensitive documents.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Password-protected PDFs</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Press does not support opening password-protected PDFs. Do not attempt to use
        this tool to circumvent PDF security, DRM, or access controls.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Open source</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Press uses pdfcpu (Apache License 2.0) as its PDF processing engine. See
        the NOTICE file in the repository for full attribution.
      </p>

      <h2 className="mt-6 text-lg font-medium text-neutral-900">Changes</h2>
      <p className="mt-2 text-sm leading-relaxed">
        These terms may be updated at any time. Continued use after changes
        constitutes acceptance of the revised terms.
      </p>

      <p className="mt-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Back to Press
        </Link>
      </p>
    </div>
  );
}
