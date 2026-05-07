import Link from 'next/link';
import { PageHeader } from './PageHeader';

interface Props {
  title: string;
  phase: number;
  kicker?: string;
  description?: string;
}

export function ComingSoon({ title, phase, kicker, description }: Props) {
  return (
    <>
      <PageHeader
        kicker={kicker ?? `Coming in Phase ${phase}`}
        title={<em className="italic">{title}</em>}
        description={description ?? `This module arrives in Phase ${phase} of the v2 rebuild. Stub page until then so the sidebar structure is visible.`}
      />
      <div className="card-base p-10 text-center">
        <div className="kicker mb-3">Phase {phase}</div>
        <h3 className="font-serif text-xl text-ink mb-2">Not built yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto mb-6">
          Come back after Phase {phase} ships. For now, other sidebar items may already work.
        </p>
        <Link href="/dashboard" className="btn-secondary !h-10 !px-4 text-[13px]">
          Back to home
        </Link>
      </div>
    </>
  );
}
