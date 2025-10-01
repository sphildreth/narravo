// SPDX-License-Identifier: Apache-2.0
import React from "react";

interface RssIconProps {
  className?: string;
  size?: number;
}

/**
 * RSS feed icon component
 * Standard RSS icon design with three arc segments and a dot
 */
export default function RssIcon({ className = "", size = 20 }: RssIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}
