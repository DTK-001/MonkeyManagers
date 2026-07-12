import { ShieldCheck, Trophy } from 'lucide-react';
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { realCompetitions } from '../../data/real-competitions';

export default function CompetitionsPage() {
  return <div className="page-wrap">
    <PageHeader eyebrow="Real matches · private glory" title="Competitions" description="Every real competition has an independent lineup, points total, and private table." action={<StatusBadge kind="muted">Awaiting fixtures</StatusBadge>} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{realCompetitions.map((competition) => <article key={competition.id} className="glass-card overflow-hidden"><div className="h-1" style={{ background: competition.colour }} /><div className="p-5"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${competition.colour}20`, color: competition.colour }}><Trophy size={21} /></span><p className="eyebrow mt-4">{competition.type}</p><h2 className="mt-1 font-display text-2xl font-bold">{competition.name}</h2><p className="mt-2 min-h-10 text-xs leading-5 text-muted">{competition.scoring}</p><div className="mt-4 border-t border-white/[0.07] pt-3 text-xs font-semibold text-muted">No real fixtures or points recorded yet</div></div></article>)}</div>
    <div className="mt-7 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-emerald/25 bg-emerald/[0.07] p-5"><ShieldCheck className="text-emerald" /><h2 className="mt-3 font-display text-2xl font-bold">Scores stay separated</h2><p className="mt-2 text-sm leading-6 text-muted">Premier League points feed the league table only. FA Cup, EFL Cup, and every European competition have their own totals and never alter league positions.</p></section><EmptyState icon={<Trophy size={30} />} title="Waiting for the real schedule" body="Competition rounds appear when the real fixtures are imported. Only players whose real clubs participate in that competition are eligible for its lineup and points." /></div>
  </div>;
}
