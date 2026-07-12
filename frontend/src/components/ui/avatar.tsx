import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizePx = { sm: 32, md: 40, lg: 64 } as const;

function Avatar({ src, alt, fallback, size = 'md', className, ...props }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg',
  };

  const px = sizePx[size];

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-geist-full',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt={alt || 'Avatar'}
          width={px}
          height={px}
          loading="lazy"
          className="aspect-square h-full w-full object-cover"
          unoptimized={src.startsWith('data:')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-geist-canvas-soft-2 text-geist-body font-medium dark:bg-neutral-800 dark:text-white">
          {fallback || '?'}
        </div>
      )}
    </div>
  );
}

export { Avatar };
