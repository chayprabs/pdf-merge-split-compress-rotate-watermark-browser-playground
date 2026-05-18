import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Credits — Press",
};

export default function CreditsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 prose dark:prose-invert">
      <h1>Credits</h1>
      <ul>
        <li>
          PDF processing:{" "}
          <a
            href="https://github.com/pdfcpu/pdfcpu"
            target="_blank"
            rel="noopener noreferrer"
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
          >
            Next.js
          </a>{" "}
          (MIT)
        </li>
      </ul>
      <p>
        Full Apache 2.0 attribution for pdfcpu is in the{" "}
        <a href="https://raw.githubusercontent.com/pdfcpu/pdfcpu/master/LICENSE.txt">
          pdfcpu license
        </a>{" "}
        and the <code>NOTICE</code> file in this repository.
      </p>
      <p>
        <Link href="/">← Home</Link>
      </p>
    </div>
  );
}
