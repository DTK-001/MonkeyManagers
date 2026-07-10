import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronRight,
  Filter,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UserRoundCheck,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { demoTeams } from '../../data/demo';
import { formatMoney, formatPoints } from '../../lib/format';
import type { DemoPlayer, Position } from '../../types';
import { PageHeader, PositionPill, StatusBadge } from '../../components/ui';

type OwnershipFilter = 'available' | 'mine' | 'all';
type SortKey = 'value' | 'form' | 'points' | 'name';

export default function MarketPage() {
  const { state, currentClub, buyPlayer, releasePlayer } = useDemo();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [ownership, setOwnership] = useState<OwnershipFilter>('available');
  const [sort, setSort] = useState<SortKey>('form');
  const [selected, setSelected] = useState<DemoPlayer | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visiblePlayers = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return state.players
      .filter((player) => {
        const team = demoTeams.find((item) => item.id === player.teamId);
        const matchesQuery =
          !normalisedQuery ||
          `${player.name} ${team?.name ?? ''}`.toLowerCase().includes(normalisedQuery);
        const matchesPosition = position === 'ALL' || player.position === position;
        const matchesOwnership =
          ownership === 'all' ||
          (ownership === 'available'
            ? !player.ownershipClubId
            : player.ownershipClubId === currentClub.id);
        return matchesQuery && matchesPosition && matchesOwnership;
      })
      .sort((a, b) =>
        sort === 'value'
          ? b.valueMinor - a.valueMinor
          : sort === 'form'
            ? b.form - a.form
            : sort === 'points'
              ? b.seasonPoints - a.seasonPoints
              : a.name.localeCompare(b.name)
      );
  }, [state.players, query, position, ownership, sort, currentClub.id]);

  function confirmAction() {
    if (!selected) return;
    if (selected.ownershipClubId === currentClub.id) releasePlayer(selected.id);
    else buyPlayer(selected.id);
    setSelected(null);
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Transfer centre"
        title="Player market"
        description="Every player has one owner inside this league. Availability is confirmed again when you sign."
        action={<StatusBadge kind="success">Open</StatusBadge>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="subtle-card p-3">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Balance</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {formatMoney(currentClub.budgetMinor)}
          </p>
        </div>
        <div className="subtle-card p-3">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Squad</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {state.players.filter((player) => player.ownershipClubId === currentClub.id).length}
          </p>
        </div>
        <div className="subtle-card hidden p-3 sm:block">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
            Free agents
          </p>
          <p className="mt-1 font-display text-2xl font-bold">
            {state.players.filter((player) => !player.ownershipClubId).length}
          </p>
        </div>
        <div className="subtle-card hidden p-3 sm:block">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
            Release rate
          </p>
          <p className="mt-1 font-display text-2xl font-bold">90%</p>
        </div>
      </div>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-white/[0.07] p-3 sm:p-4">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search players or clubs</span>
              <Search
                className="pointer-events-none absolute left-3 top-3.5 text-muted"
                size={17}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="field pl-10"
                placeholder="Search player or real club"
              />
            </label>
            <button
              onClick={() => setFiltersOpen((value) => !value)}
              type="button"
              className="button-secondary px-3 sm:hidden"
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={18} />
              <span className="sr-only">Filters</span>
            </button>
          </div>
          <div className={`${filtersOpen ? 'flex' : 'hidden'} mt-3 flex-wrap gap-2 sm:flex`}>
            {(['available', 'mine', 'all'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setOwnership(option)}
                className={`chip min-h-9 capitalize ${ownership === option ? '!border-gold/40 !bg-gold/10 !text-gold' : ''}`}
              >
                {option === 'mine' ? 'My squad' : option}
              </button>
            ))}
            <span className="mx-1 hidden h-9 w-px bg-white/10 sm:block" />
            {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPosition(option)}
                className={`chip min-h-9 ${position === option ? '!border-gold/40 !bg-gold/10 !text-gold' : ''}`}
              >
                {option}
              </button>
            ))}
            <label className="ml-auto flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-muted">
              <ArrowDownUp size={14} />
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="min-h-7 bg-transparent font-semibold text-ivory outline-none"
              >
                <option className="bg-ink" value="form">
                  Form
                </option>
                <option className="bg-ink" value="value">
                  Price
                </option>
                <option className="bg-ink" value="points">
                  Season score
                </option>
                <option className="bg-ink" value="name">
                  Name
                </option>
              </select>
            </label>
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(15rem,1fr)_9rem_7rem_7rem_8rem] border-b border-white/[0.07] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted md:grid">
          <span>Player</span>
          <span>Ownership</span>
          <span>Value</span>
          <span>Form</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-white/[0.07]">
          {visiblePlayers.map((player) => {
            const team = demoTeams.find((item) => item.id === player.teamId);
            const mine = player.ownershipClubId === currentClub.id;
            const owned = Boolean(player.ownershipClubId);
            const rising = player.valueMinor >= player.previousValueMinor;
            return (
              <article
                key={player.id}
                className="grid min-h-[5.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 hover:bg-white/[0.02] md:grid-cols-[minmax(15rem,1fr)_9rem_7rem_7rem_8rem] md:px-4"
              >
                <Link to={`/app/market/${player.id}`} className="flex min-w-0 items-center gap-3">
                  <span
                    className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] font-display text-lg font-bold"
                    style={{ boxShadow: `inset 0 -3px 0 ${team?.colour ?? '#c3a46d'}` }}
                  >
                    {player.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ivory">
                        {player.name}
                      </span>
                      <PositionPill position={player.position} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {team?.name} · {formatPoints(player.seasonPoints)} pts
                    </span>
                  </span>
                </Link>
                <div className="hidden md:block">
                  {mine ? (
                    <StatusBadge kind="success">Yours</StatusBadge>
                  ) : owned ? (
                    <StatusBadge kind="muted">Owned</StatusBadge>
                  ) : (
                    <StatusBadge kind="warning">Available</StatusBadge>
                  )}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold">{formatMoney(player.valueMinor)}</p>
                  <p className={`text-[0.62rem] ${rising ? 'text-emerald' : 'text-danger'}`}>
                    {rising ? '+' : ''}
                    {((player.valueMinor / player.previousValueMinor - 1) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold">{formatPoints(player.form)}</p>
                  <p className="text-[0.62rem] text-muted">last 5 avg</p>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  {!owned || mine ? (
                    <button
                      type="button"
                      onClick={() => setSelected(player)}
                      disabled={!mine && player.valueMinor > currentClub.budgetMinor}
                      className={
                        mine
                          ? 'button-danger min-h-10 px-3 text-xs'
                          : 'button-primary min-h-10 px-3 text-xs'
                      }
                    >
                      {mine ? 'Release' : 'Buy'}
                    </button>
                  ) : (
                    <Link
                      to={`/app/market/${player.id}`}
                      className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-white/[0.05]"
                    >
                      <ChevronRight size={19} />
                      <span className="sr-only">View {player.name}</span>
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {visiblePlayers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Filter className="mx-auto text-gold" />
            <h2 className="mt-3 font-display text-2xl font-bold">No players found</h2>
            <p className="mt-1 text-sm text-muted">
              Try a different name, ownership state or position.
            </p>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-end bg-black/65 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-title"
        >
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-navy p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold">
                {selected.ownershipClubId === currentClub.id ? (
                  <UserRoundCheck size={23} />
                ) : (
                  <ShoppingBag size={23} />
                )}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-white/[0.05]"
                aria-label="Cancel"
              >
                <X size={19} />
              </button>
            </div>
            <p className="eyebrow mt-4">
              {selected.ownershipClubId === currentClub.id ? 'Release player' : 'Confirm signing'}
            </p>
            <h2 id="transfer-title" className="mt-2 font-display text-3xl font-bold">
              {selected.name}
            </h2>
            {selected.ownershipClubId === currentClub.id ? (
              <>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Return this player to the free-agent pool. Your club receives 90% of the current
                  book value.
                </p>
                <div className="subtle-card mt-4 flex items-center justify-between p-3">
                  <span className="text-xs text-muted">Exact refund</span>
                  <span className="font-display text-2xl font-bold text-emerald">
                    {formatMoney(Math.round(selected.valueMinor * 0.9))}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="subtle-card mt-4 divide-y divide-white/[0.07]">
                  <div className="flex items-center justify-between p-3">
                    <span className="text-xs text-muted">Current value</span>
                    <span className="font-display text-xl font-bold">
                      {formatMoney(selected.valueMinor)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-xs text-muted">Balance after signing</span>
                    <span className="font-display text-xl font-bold text-emerald">
                      {formatMoney(currentClub.budgetMinor - selected.valueMinor)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted">
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald" /> Ownership and funds
                  will be verified atomically before completion.
                </p>
              </>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSelected(null)} className="button-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction}
                className={
                  selected.ownershipClubId === currentClub.id ? 'button-danger' : 'button-primary'
                }
              >
                {selected.ownershipClubId === currentClub.id
                  ? 'Release player'
                  : 'Confirm purchase'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
