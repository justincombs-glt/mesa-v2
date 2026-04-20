import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="card-base p-10 md:p-14 text-center">
      {icon && (
        <div className="w-14 h-14 rounded-full bg-sand-50 border border-sand-100 grid place-items-center mx-auto mb-5 text-ink-dim">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-2xl text-ink mb-2">{title}</h3>
      <p className="text-[15px] text-ink-dim max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}
