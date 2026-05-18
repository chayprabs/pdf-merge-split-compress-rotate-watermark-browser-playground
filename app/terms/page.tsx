import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of service — Press",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 prose dark:prose-invert">
      <h1>Terms of service</h1>
      <p>
        Use at your own risk. Press is provided free of charge and as-is,
        without warranty of any kind, under the MIT License.
      </p>
      <p>
        No warranty on output correctness. PDF processing is performed by
        pdfcpu. The operator makes no warranty that processed PDFs are accurate,
        complete, or free of errors. Always verify output before relying on it
        for important purposes.
      </p>
      <p>
        Acceptable use. You may not use Press to process files in a manner that
        violates applicable laws. You are responsible for having the right to
        process the PDF files you use with this tool.
      </p>
      <p>
        No sensitive data guarantee. While PDF files are processed locally and
        never transmitted, you should be aware that browser memory is accessible
        to other extensions or scripts running in the same browser profile. Use
        a dedicated browser profile or private window when processing highly
        sensitive documents.
      </p>
      <p>
        Password-protected PDFs. Press does not support opening
        password-protected PDFs. Do not attempt to use this tool to circumvent
        PDF security or DRM.
      </p>
      <p>
        Open source components. Press uses pdfcpu (Apache License 2.0, Copyright
        2017 Horst Rutter) as its PDF processing engine. See{" "}
        <Link href="/credits/">/credits</Link> and the NOTICE file for full
        attribution.
      </p>
      <p>
        Changes. These terms may be updated at any time. Continued use
        constitutes acceptance.
      </p>
      <p>
        <Link href="/">← Home</Link>
      </p>
    </div>
  );
}
