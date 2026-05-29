import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Credits — Press",
};

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-neutral-700">
      <h1 className="text-2xl font-semibold text-neutral-900">Credits</h1>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          PDF processing:{" "}
          <a
            href="https://github.com/pdfcpu/pdfcpu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-900 underline"
          >
            pdfcpu
          </a>{" "}
          by Horst Rutter (Apache 2.0)
        </li>
        <li>
          Compression:{" "}
          <a
            href="https://github.com/101arrowz/fflate"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-900 underline"
          >
            fflate
          </a>{" "}
          (MIT)
        </li>
        <li>
          Drag and drop:{" "}
          <a
            href="https://dndkit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-900 underline"
          >
            dnd-kit
          </a>{" "}
          (MIT)
        </li>
        <li>
          Framework:{" "}
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-900 underline"
          >
            Next.js
          </a>{" "}
          (MIT)
        </li>
      </ul>
      <p className="mt-6 text-sm leading-relaxed">
        Full Apache 2.0 attribution for pdfcpu is in the{" "}
        <a
          href="https://raw.githubusercontent.com/pdfcpu/pdfcpu/master/LICENSE.txt"
          className="text-neutral-900 underline"
        >
          pdfcpu license
        </a>{" "}
        and the <code>NOTICE</code> file in this repository.
      </p>
      <p className="mt-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Back to Press
        </Link>
      </p>
    </div>
  );
}
