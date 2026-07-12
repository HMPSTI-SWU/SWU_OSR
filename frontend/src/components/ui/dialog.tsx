'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-geist-ink/50 backdrop-blur-sm dark:bg-black/70"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative bg-geist-canvas dark:bg-neutral-900 rounded-geist-lg geist-level-5 max-w-lg w-full max-h-[85vh] overflow-auto animate-scale-in">
          {children}
        </div>
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-display-sm text-geist-ink dark:text-white', className)} {...props} />
  );
}

function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
}

function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="absolute right-4 top-4 rounded-geist-sm p-1 text-geist-mute hover:text-geist-ink hover:bg-geist-canvas-soft-2 transition-colors dark:text-white dark:hover:text-white dark:hover:bg-neutral-800"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogClose };
