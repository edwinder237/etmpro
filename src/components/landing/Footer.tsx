import Link from "next/link";

const serif = { fontFamily: "var(--font-serif)" } as const;

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #e8dece" }}>
      <div className="mx-auto max-w-[1100px] px-6 md:px-10 py-[26px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span style={serif} className="text-[18px]">EisenQ</span>
          <span className="text-[13px]" style={{ color: "#a89a80" }}>© {new Date().getFullYear()} · All rights reserved.</span>
        </div>
        <div className="text-[13px]" style={{ color: "#a89a80" }}>
          Created by{" "}
          <Link href="https://lumeve.com" target="_blank" rel="noopener noreferrer" style={{ color: "#7f6a45" }} className="hover:underline">
            Lumeve
          </Link>
        </div>
      </div>
    </footer>
  );
}
