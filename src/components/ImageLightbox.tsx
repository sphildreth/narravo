"use client";
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ImageLightboxProps {
  src: string;
  alt?: string | undefined;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    
    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!mounted) return null;

  const lightbox = (
    <div
      className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close lightbox"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt || 'Full size image'}
          className="max-w-full max-h-[95vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
          loading="eager"
        />
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        Press <kbd className="px-2 py-1 bg-white/10 rounded">Esc</kbd> or click outside to close
      </div>
    </div>
  );

  return createPortal(lightbox, document.body);
}

interface ImageWithLightboxProps {
  src: string;
  alt?: string | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

export function ImageWithLightbox({ src, alt, className, style }: ImageWithLightboxProps) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className || ''} cursor-zoom-in hover:opacity-90 transition-opacity`}
        style={style}
        onClick={() => setShowLightbox(true)}
        loading="lazy"
      />
      {showLightbox && (
        <ImageLightbox
          src={src}
          alt={alt}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
}
