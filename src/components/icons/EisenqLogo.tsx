import React from "react";
import { cn } from "~/lib/utils";

interface EisenqLogoProps {
  className?: string;
  size?: number;
}

/**
 * The EisenQ mark — warm-brown rounded square with an ivory Newsreader italic "Q".
 */
export const EisenqLogo: React.FC<EisenqLogoProps> = ({ className, size = 36 }) => {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        background: "#7f6a45",
        borderRadius: size * 0.22,
      }}
    >
      <span
        className="italic"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
          fontSize: size * 0.58,
          color: "#faf6ee",
          lineHeight: 1,
        }}
      >
        Q
      </span>
    </div>
  );
};
