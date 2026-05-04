'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, description, children, maxWidth = '520px' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end md:place-items-center p-0 md:p-4 bg-ink/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-paper border border-ink-hair rounded-t-2xl md:rounded-2xl p-5 md:p-8 shadow-card-hover max-h-[92vh] md:max-h-[88vh] overflow-y-auto"
        style={{ maxWidth }}
      >
        <div className="flex items-start justify-between mb-5 md:mb-6 gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-xl md:text-2xl text-ink leading-tight">{title}</h2>
            {description && (
              <p className="text-sm text-ink-dim mt-1.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 md:w-8 md:h-8 rounded-full border border-ink-hair text-ink-faint grid place-items-center hover:text-ink hover:border-ink transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
