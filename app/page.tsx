import Link from "next/link";

const tools = [
  { name: "Merge", href: "/tools/merge", description: "Combine multiple PDFs into one" },
  { name: "Split", href: "/tools/split", description: "Split PDF into multiple files" },
  { name: "Rotate", href: "/tools/rotate", description: "Rotate pages 90, 180, or 270 degrees" },
  { name: "Validate", href: "/tools/validate", description: "Check PDF structure validity" },
  { name: "Optimize", href: "/tools/optimize", description: "Compress and optimize PDF" },
  { name: "Extract Pages", href: "/tools/extract", description: "Extract specific pages to new PDF" },
  { name: "Remove Pages", href: "/tools/remove", description: "Delete specific pages from PDF" },
  { name: "Watermark", href: "/tools/watermark", description: "Add text watermark to PDF" },
  { name: "Set Metadata", href: "/tools/metadata", description: "Set title, author, and other metadata" },
];

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Press</h1>
        <p className="text-gray-600 mt-2">Browser-native PDF tools powered by WebAssembly</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.name}
            href={tool.href}
            className="block p-6 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-semibold">{tool.name}</h2>
            <p className="text-gray-600 mt-2">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}