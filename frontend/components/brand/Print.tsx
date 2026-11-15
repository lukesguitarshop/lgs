import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * A photo presented as a print: cream border, slight tilt, straightens on hover.
 * Absolutely positioned; the caller supplies size, position and rotation, and a
 * parent with a fixed aspect ratio to place it in.
 */
export function Print({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute overflow-hidden border-[6px] border-background bg-background shadow-[0_24px_50px_-28px_rgba(0,0,0,0.9)] transition-transform duration-500 ease-out hover:z-30 hover:rotate-0 hover:scale-[1.03]',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 50vw, 320px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
