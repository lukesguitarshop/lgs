'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  images: string[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  alt?: string;
}

export function ImageLightbox({ images, index, onClose, onIndexChange, alt = 'Image' }: ImageLightboxProps) {
  const open = index !== null && index >= 0 && index < images.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index! > 0) onIndexChange(index! - 1);
      if (e.key === 'ArrowRight' && index! < images.length - 1) onIndexChange(index! + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open) return null;

  const goPrev = () => index! > 0 && onIndexChange(index! - 1);
  const goNext = () => index! < images.length - 1 && onIndexChange(index! + 1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors cursor-pointer"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      <div
        className="relative w-[90vw] h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={images[index!]}
          alt={`${alt} ${index! + 1}`}
          fill
          sizes="90vw"
          className="object-contain"
          quality={100}
        />
      </div>

      {images.length > 1 && (
        <>
          {index! > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-3 text-white transition-colors cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}
          {index! < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-3 text-white transition-colors cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
            {index! + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}
