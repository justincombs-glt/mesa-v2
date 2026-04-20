import type { ReactNode } from 'react';

interface PageHeaderProps {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-10">
      <div className="max-w-2xl">
        {kicker && <div className="kicker mb-3">{kicker}</div>}
        <h1 className="font-serif text-3xl md:text-4xl text-ink leading-[1.15]">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] text-ink-dim mt-3 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
