import { ShieldCheck, Trophy, UsersRound } from 'lucide-react';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { formatMoney, formatPoints } from '../../lib/format';
import { PageHeader, StatusBadge } from '../../components/ui';

export default function LeaguePage() {
  const { state, currentClub } = useDemo();
  const sorted = [...state.clubs].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
  const scoringStarted = sorted.some((club) => club.totalPoints > 0);

  return <div className="page-wrap">
    <PageHeader eyebrow="Private league" title={state.leagueName} description={`${sorted.length} manager${sorted.length === 1 ? '' : 's'} · New season · Europe/London`} action={<StatusBadge kind="success">Active</StatusBadge>} />
    <section className="glass-card overflow-hidden">
      <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold"><UsersRound size={29} /></span><div className="min-w-0 flex-1"><h2 className="font-display text-3xl font-bold">League table</h2><p className="mt-1 text-xs text-muted">{scoringStarted ? 'Ranked by points earned in this private league.' : 'The table will begin once real scores are recorded.'}</p></div></div>
      <div className="hidden grid-cols-[3rem_minmax(13rem,1fr)_7rem_7rem_7rem] border-b border-white/[0.07] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted md:grid"><span>#</span><span>Club</span><span>Balance</span><span>Squad value</span><span className="text-right">Points</span></div>
      {sorted.map((club, index) => { const squadValue = state.players.filter((player) => player.ownershipClubId === club.id).reduce((sum, player) => sum + player.valueMinor, 0); return <article key={club.id} className={`grid min-h-20 grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-2 border-b border-white/[0.07] px-3 py-3 last:border-0 md:grid-cols-[3rem_minmax(13rem,1fr)_7rem_7rem_7rem] md:px-4 ${club.id === currentClub.id ? 'bg-gold/[0.06]' : ''}`}><span className="font-display text-2xl font-bold text-gold">{scoringStarted ? index + 1 : '—'}</span><div className="flex min-w-0 items-center gap-3"><ClubBadge {...club} className="h-12 w-12 shrink-0" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{club.name}</p><p className="truncate text-[0.65rem] text-muted">{club.manager}{club.id === currentClub.id ? ' · You' : ''}</p></div></div><span className="hidden text-xs md:block">{formatMoney(club.budgetMinor)}</span><span className="hidden text-xs md:block">{formatMoney(squadValue)}</span><span className="text-right font-display text-xl font-bold">{formatPoints(club.totalPoints)}</span></article>; })}
    </section>
    <div className="mt-7 grid gap-7 lg:grid-cols-2"><section className="glass-card p-6 text-center"><Trophy className="mx-auto text-gold" size={28} /><h2 className="mt-3 font-display text-2xl font-bold">No league activity yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Transfers, fixture results, and scoring updates will appear here when they genuinely happen.</p></section><section className="rounded-2xl border border-emerald/25 bg-emerald/[0.07] p-6"><ShieldCheck className="text-emerald" /><h2 className="mt-3 font-display text-2xl font-bold">Clean starting state</h2><p className="mt-2 text-sm leading-6 text-muted">No placeholder clubs, scores, or fixture results are included in this league.</p></section></div>
  </div>;
}
