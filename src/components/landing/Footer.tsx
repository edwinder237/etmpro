import Link from "next/link";
import { EisenqLogo } from "~/components/icons/EisenqLogo";

export function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-gray-800">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Copyright */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <EisenqLogo size={24} />
            <span className="text-sm font-medium text-white">EisenQ</span>
          </div>
          <span className="text-sm text-gray-500">
            {new Date().getFullYear()} All rights reserved.
          </span>
        </div>

        {/* Creator Credit */}
        <div className="text-sm text-gray-500">
          Created by{" "}
          <Link
            href="https://lumeve.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 transition-colors"
          >
            Lumeve
          </Link>
        </div>
      </div>
    </footer>
  );
}
