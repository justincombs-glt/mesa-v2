import type { ReactNode } from 'react';

interface PageHeaderProps {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start md:items-end justify-between gap-3 md:gap-4 mb-6 md:mb-10">
      <div className="max-w-2xl min-w-0">
        {kicker && <div className="kicker mb-2 md:mb-3">{kicker}</div>}
        <h1 className="font-serif text-2xl md:text-4xl text-ink leading-[1.15]">
          {title}
        </h1>
        {description && (
          <p className="text-sm md:text-[15px] text-ink-dim mt-2 md:mt-3 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
