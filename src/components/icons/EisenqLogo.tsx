import React from "react";
import { cn } from "~/lib/utils";

interface EisenqLogoProps {
  className?: string;
  size?: number;
}

export const EisenqLogo: React.FC<EisenqLogoProps> = ({ className, size = 36 }) => {
  return (
    <div
      className={cn(
        "bg-blue-600 rounded-md flex items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="text-white font-bold"
        style={{ fontSize: size * 0.5 }}
      >
        Q
      </span>
    </div>
  );
};
