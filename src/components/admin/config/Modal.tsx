"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";

export function Modal({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="relative w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-white">X</button>
      </div>
    </div>
  );
}
