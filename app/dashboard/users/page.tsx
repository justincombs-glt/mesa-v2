import { requireProfile } from '@/lib/auth';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireProfile();
  return <ComingSoon title="Users" phase={2} />;
}
