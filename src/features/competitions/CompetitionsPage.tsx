import { Trophy } from 'lucide-react';
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui';

export default function CompetitionsPage() {
  return <div className="page-wrap">
    <PageHeader eyebrow="Real matches · private glory" title="Competitions" description="Only competitions configured for your private league will appear here." action={<StatusBadge kind="muted">Not configured</StatusBadge>} />
    <EmptyState icon={<Trophy size={30} />} title="No competitions yet" body="This new league has no seeded cups, tables, fixtures, or scores. Add the real competitions and scoring schedule before the season begins." />
  </div>;
}
