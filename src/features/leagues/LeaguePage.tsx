import { useState } from 'react';
import {
  Check,
  Clipboard,
  Coins,
  History,
  Link2,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserPlus,
  UsersRound
} from 'lucide-react';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { formatMoney, formatPoints, relativeTime } from '../../lib/format';
import { PageHeader, SectionTitle, StatusBadge } from '../../components/ui';

export default function LeaguePage() {
  const { state, currentClub } = useDemo();
  const [copied, setCopied] = useState(false);
  const sorted = [...state.clubs].sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.competitionWins - a.competitionWins ||
      b.highestRoundScore - a.highestRoundScore ||
      a.name.localeCompare(b.name)
  );
  function copyInvite() {
    void navigator.clipboard.writeText('FRIDAY26').catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Private league"
        title="Friday Night Football"
        description="Four managers · 2026/27 season · Europe/London"
        action={
          <button onClick={copyInvite} type="button" className="button-secondary">
            <UserPlus size={16} /> <span className="hidden sm:inline">Invite manager</span>
          </button>
        }
      />
      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
            <UsersRound size={29} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-3xl font-bold">The table</h2>
              <StatusBadge kind="success">Active season</StatusBadge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Ranked by total points, competition wins, highest round, then club name.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="subtle-card p-3">
              <p className="text-[0.62rem] uppercase tracking-wider text-muted">Your gap</p>
              <p className="font-display text-2xl font-bold text-gold">12.45</p>
            </div>
            <div className="subtle-card p-3">
              <p className="text-[0.62rem] uppercase tracking-wider text-muted">Round</p>
              <p className="font-display text-2xl font-bold">9</p>
            </div>
          </div>
        </div>
        <div className="hidden grid-cols-[3rem_minmax(13rem,1fr)_6rem_7rem_7rem_7rem] border-b border-white/[0.07] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Club</span>
          <span>Form</span>
          <span>Balance</span>
          <span>Squad value</span>
          <span className="text-right">Points</span>
        </div>
        {sorted.map((club, index) => {
          const squadValue = state.players
            .filter((player) => player.ownershipClubId === club.id)
            .reduce((sum, player) => sum + player.valueMinor, 0);
          return (
            <article
              key={club.id}
              className={`grid min-h-20 grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-2 border-b border-white/[0.07] px-3 py-3 last:border-0 md:grid-cols-[3rem_minmax(13rem,1fr)_6rem_7rem_7rem_7rem] md:px-4 ${club.id === currentClub.id ? 'bg-gold/[0.06]' : ''}`}
            >
              <span className="font-display text-2xl font-bold text-gold">{index + 1}</span>
              <div className="flex min-w-0 items-center gap-3">
                <ClubBadge {...club} className="h-12 w-12 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{club.name}</p>
                  <p className="truncate text-[0.65rem] text-muted">
                    {club.manager}
                    {club.id === currentClub.id ? ' · You' : ''}
                  </p>
                </div>
              </div>
              <div className="hidden gap-1 md:flex">
                {club.form.slice(-3).map((item, formIndex) => (
                  <span
                    key={formIndex}
                    className={`grid h-5 w-5 place-items-center rounded-full text-[0.5rem] font-bold ${item === 'W' ? 'bg-emerald' : item === 'L' ? 'bg-danger' : 'bg-white/10'}`}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <span className="hidden text-xs md:block">{formatMoney(club.budgetMinor)}</span>
              <span className="hidden text-xs md:block">{formatMoney(squadValue)}</span>
              <span className="text-right font-display text-xl font-bold">
                {formatPoints(club.totalPoints)}
              </span>
            </article>
          );
        })}
      </section>
      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
        <section>
          <SectionTitle title="League activity" eyebrow="The latest" />
          <div className="glass-card divide-y divide-white/[0.07]">
            {state.activity.map((item) => (
              <article key={item.id} className="flex gap-3 p-4">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.type === 'transfer' ? 'bg-gold/10 text-gold' : item.type === 'sync' ? 'bg-emerald/10 text-emerald' : 'bg-white/[0.05] text-muted'}`}
                >
                  {item.type === 'transfer' ? (
                    <Coins size={17} />
                  ) : item.type === 'sync' ? (
                    <RefreshCw size={17} />
                  ) : item.type === 'score' ? (
                    <Trophy size={17} />
                  ) : (
                    <History size={17} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <time className="shrink-0 text-[0.62rem] text-muted">
                      {relativeTime(item.timestamp)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Invite code</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Grow the league</h2>
              </div>
              <Link2 className="text-gold" />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Share only with friends. Admins can revoke this code at any time.
            </p>
            <button
              type="button"
              onClick={copyInvite}
              className="mt-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-dashed border-gold/35 bg-gold/[0.05] px-4"
            >
              <span className="font-mono text-lg font-bold tracking-[0.18em] text-gold">
                FRIDAY26
              </span>
              {copied ? (
                <Check size={18} className="text-emerald" />
              ) : (
                <Clipboard size={18} className="text-muted" />
              )}
            </button>
          </section>
          <section className="rounded-2xl border border-emerald/20 bg-emerald/[0.06] p-4">
            <ShieldCheck className="text-emerald" />
            <h2 className="mt-3 font-display text-2xl font-bold">League integrity</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              No duplicate active ownership, negative balances or edits to locked lineups detected.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
