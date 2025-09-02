import React from "react";
import { cn } from "~/lib/utils";

interface TaskIconProps {
  className?: string;
  size?: number;
}

export const TaskIcon: React.FC<TaskIconProps> = ({ className, size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("", className)}
    >
      {/* Checkbox - checked */}
      <rect
        x="2"
        y="4"
        width="3"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
      />
      {/* Checkmark */}
      <path
        d="M2.8 5.2L3.5 5.9L4.7 4.7"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* First line */}
      <line
        x1="7"
        y1="5.5"
        x2="16"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Second checkbox - unchecked */}
      <rect
        x="2"
        y="10"
        width="3"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      
      {/* Second line */}
      <line
        x1="7"
        y1="11.5"
        x2="20"
        y2="11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Third line - shorter */}
      <line
        x1="7"
        y1="17.5"
        x2="14"
        y2="17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Third checkbox - unchecked */}
      <rect
        x="2"
        y="16"
        width="3"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
};