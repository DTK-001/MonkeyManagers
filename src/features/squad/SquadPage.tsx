import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleAlert,
  Crown,
  LayoutGrid,
  List,
  LockKeyhole,
  Plus,
  Save,
  Shield,
  Star
} from 'lucide-react';
import clsx from 'clsx';
import { useDemo } from '../../app/demo-store';
import { demoTeams } from '../../data/demo';
import { formatMoney } from '../../lib/format';
import type { DemoPlayer, Position } from '../../types';
import { PageHeader, PositionPill, StatusBadge } from '../../components/ui';

const formationOrder: Position[] = ['FWD', 'MID', 'DEF', 'GK'];

export default function SquadPage() {
  const { state, currentClub, toggleStarter, setCaptain, setViceCaptain, saveLineup } = useDemo();
  const [view, setView] = useState<'pitch' | 'list'>('pitch');
  const [addingPosition, setAddingPosition] = useState<Position | null>(null);
  const squad = state.players.filter((player) => player.ownershipClubId === currentClub.id);
  const starters = state.starters
    .map((id) => state.players.find((player) => player.id === id))
    .filter((player): player is DemoPlayer => Boolean(player));
  const bench = squad.filter((player) => !state.starters.includes(player.id));
  const counts = useMemo(
    () => ({
      GK: starters.filter((p) => p.position === 'GK').length,
      DEF: starters.filter((p) => p.position === 'DEF').length,
      MID: starters.filter((p) => p.position === 'MID').length,
      FWD: starters.filter((p) => p.position === 'FWD').length
    }),
    [starters]
  );
  const formationValid =
    starters.length === 11 &&
    counts.GK === 1 &&
    counts.DEF >= 3 &&
    counts.DEF <= 5 &&
    counts.MID >= 2 &&
    counts.MID <= 5 &&
    counts.FWD >= 1 &&
    counts.FWD <= 3;
  const positionCandidates = addingPosition
    ? bench.filter((player) => player.position === addingPosition)
    : [];

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Team selection"
        title="Your squad"
        description="Choose your squad now. A competition round and deadline will appear once your league schedule is configured."
        action={<StatusBadge kind="muted">No deadline set</StatusBadge>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Competition</span>
          <select className="field min-w-56 appearance-none pr-10" disabled>
            <option>No competition configured</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-3.5 text-muted"
            size={16}
          />
        </label>
        <label className="relative">
          <span className="sr-only">Round</span>
          <select className="field appearance-none pr-10" disabled>
            <option>No round scheduled</option>
            <option>Round 8 · locked</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-3.5 text-muted"
            size={16}
          />
        </label>
        <div className="ml-auto flex rounded-xl border border-white/10 bg-white/[0.035] p-1">
          <button
            type="button"
            onClick={() => setView('pitch')}
            className={clsx(
              'grid h-10 min-h-10 w-10 place-items-center rounded-lg',
              view === 'pitch' ? 'bg-white/10 text-gold' : 'text-muted'
            )}
            aria-label="Pitch view"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={clsx(
              'grid h-10 min-h-10 w-10 place-items-center rounded-lg',
              view === 'list' ? 'bg-white/10 text-gold' : 'text-muted'
            )}
            aria-label="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-gold" />
              <span className="text-sm font-semibold">
                Formation {counts.DEF}-{counts.MID}-{counts.FWD}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {formationValid ? (
                <>
                  <Check size={15} className="text-emerald" />
                  <span className="text-emerald">Valid XI</span>
                </>
              ) : (
                <>
                  <CircleAlert size={15} className="text-gold" />
                  <span className="text-gold">Needs attention</span>
                </>
              )}
            </div>
          </div>
          {view === 'pitch' ? (
            <div className="pitch-lines relative flex min-h-[36rem] flex-col justify-around overflow-hidden px-3 py-5 sm:min-h-[40rem] sm:px-8 sm:py-7">
              {formationOrder.map((position) => (
                <div
                  key={position}
                  className="relative z-10 flex min-h-[5.5rem] w-full flex-1 items-center justify-evenly gap-2 sm:min-h-[6.5rem] sm:gap-4"
                >
                  {starters
                    .filter((player) => player.position === position)
                    .map((player) => (
                      <PlayerToken
                        key={player.id}
                        player={player}
                        captain={state.captainId === player.id}
                        vice={state.viceCaptainId === player.id}
                        onToggle={() => toggleStarter(player.id)}
                      />
                    ))}
                  <button
                    type="button"
                    onClick={() => setAddingPosition(position)}
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-dashed border-gold/55 bg-ink/30 text-[0.63rem] font-bold text-gold transition hover:scale-105 hover:bg-gold/15 sm:h-[4.7rem] sm:w-[4.7rem]"
                    aria-label={`Add a ${position} to the starting lineup`}
                  >
                    <Plus size={17} /> Add {position}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {squad.map((player) => (
                <PlayerListRow
                  key={player.id}
                  player={player}
                  starter={state.starters.includes(player.id)}
                  captain={state.captainId === player.id}
                  vice={state.viceCaptainId === player.id}
                  onToggle={() => toggleStarter(player.id)}
                  onCaptain={() => setCaptain(player.id)}
                  onVice={() => setViceCaptain(player.id)}
                />
              ))}
            </div>
          )}
          {addingPosition ? (
            <div className="border-t border-white/[0.07] bg-ink/35 p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Starting lineup</p><h2 className="mt-1 font-display text-xl font-bold">Add a {addingPosition}</h2></div><button type="button" onClick={() => setAddingPosition(null)} className="button-secondary min-h-9 px-3 text-xs">Cancel</button></div>
              {positionCandidates.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{positionCandidates.map((player) => <button key={player.id} type="button" onClick={() => { toggleStarter(player.id); setAddingPosition(null); }} className="subtle-card flex min-h-12 items-center justify-between gap-3 px-3 text-left transition hover:border-gold/45"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{player.name}</span><span className="mt-1 block"><PositionPill position={player.position} /></span></span><span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-gold"><Plus size={14} /> Add</span></button>)}</div> : <p className="mt-3 rounded-xl border border-white/10 p-3 text-xs leading-5 text-muted">You do not have an available {addingPosition} on the bench. Sign one from the player market first.</p>}
            </div>
          ) : null}
        </section>

        <aside className="space-y-5">
          <section className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
              <div>
                <p className="eyebrow">Bench order</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Substitutes</h2>
              </div>
              <span className="text-xs text-muted">{bench.length}/7 shown</span>
            </div>
            <div className="divide-y divide-white/[0.07]">
              {bench.slice(0, 7).map((player, index) => (
                <div key={player.id} className="flex min-h-16 items-center gap-2.5 px-3 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{player.name}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <PositionPill position={player.position} />
                      <span className="text-[0.62rem] text-muted">
                        {formatMoney(player.valueMinor)}
                      </span>
                    </span>
                  </div>
                  <button onClick={() => toggleStarter(player.id)} type="button" className="button-secondary min-h-10 px-3 text-xs"><Plus size={14} /> Add</button>
                </div>
              ))}
              {bench.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted">No substitutes selected.</p>
              ) : null}
            </div>
          </section>

          <section className="glass-card p-4">
            <p className="eyebrow">Leadership</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Captaincy</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Captain · 1.5× points</span>
                <select
                  className="field"
                  value={state.captainId ?? ''}
                  onChange={(event) => setCaptain(event.target.value)}
                >
                  <option value="">Choose captain</option>
                  {starters.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Vice-captain</span>
                <select
                  className="field"
                  value={state.viceCaptainId ?? ''}
                  onChange={(event) => setViceCaptain(event.target.value)}
                >
                  <option value="">Choose vice-captain</option>
                  {starters.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section
            className={`rounded-2xl border p-4 ${formationValid && state.captainId && state.viceCaptainId ? 'border-emerald/20 bg-emerald/[0.06]' : 'border-gold/20 bg-gold/[0.06]'}`}
          >
            <div className="flex items-center gap-2">
              {formationValid ? (
                <Check size={17} className="text-emerald" />
              ) : (
                <CircleAlert size={17} className="text-gold" />
              )}
              <h2 className="text-sm font-bold">
                {formationValid ? 'Formation is valid' : `${starters.length}/11 starters selected`}
              </h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              1 goalkeeper · 3–5 defenders · 2–5 midfielders · 1–3 forwards. Players lock when their
              fixture starts.
            </p>
            <button
              type="button"
              onClick={saveLineup}
              className="button-primary mt-4 w-full"
              disabled={!formationValid}
            >
              <Save size={16} /> Save lineup
            </button>
          </section>
          <p className="flex items-start gap-2 px-2 text-[0.65rem] leading-5 text-muted">
            <LockKeyhole size={13} className="mt-0.5 shrink-0" /> Auto-substitutions run
            deterministically after the round and always preserve a valid formation.
          </p>
        </aside>
      </div>
    </div>
  );
}

function PlayerToken({
  player,
  captain,
  vice,
  onToggle
}: {
  player: DemoPlayer;
  captain: boolean;
  vice: boolean;
  onToggle: () => void;
}) {
  const team = demoTeams.find((item) => item.id === player.teamId);
  return (
    <button
      onClick={onToggle}
      type="button"
      className="group flex w-[4.7rem] min-w-0 flex-col items-center sm:w-24"
      aria-label={`Remove ${player.name} from starting lineup`}
    >
      <span
        className="relative grid h-12 w-12 place-items-center rounded-full border-2 bg-ink text-sm font-bold shadow-lg transition group-hover:-translate-y-1 sm:h-14 sm:w-14"
        style={{ borderColor: team?.colour }}
      >
        {player.name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)}
        {captain || vice ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-h-5 w-5 place-items-center rounded-full bg-gold text-[0.55rem] font-black text-ink">
            {captain ? 'C' : 'V'}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 max-w-full truncate rounded-md bg-ink/90 px-1.5 py-1 text-[0.57rem] font-semibold shadow">
        {player.name}
      </span>
    </button>
  );
}

function PlayerListRow({
  player,
  starter,
  captain,
  vice,
  onToggle,
  onCaptain,
  onVice
}: {
  player: DemoPlayer;
  starter: boolean;
  captain: boolean;
  vice: boolean;
  onToggle: () => void;
  onCaptain: () => void;
  onVice: () => void;
}) {
  const team = demoTeams.find((item) => item.id === player.teamId);
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-xs font-bold"
          style={{ boxShadow: `inset 0 -3px 0 ${team?.colour}` }}
        >
          {player.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{player.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <PositionPill position={player.position} />
            <span className="text-[0.62rem] text-muted">{team?.shortName}</span>
            {captain ? (
              <span className="text-[0.62rem] font-bold text-gold">Captain</span>
            ) : vice ? (
              <span className="text-[0.62rem] font-bold text-gold">Vice</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCaptain}
          disabled={!starter}
          className="grid h-10 min-h-10 w-10 place-items-center rounded-lg text-muted hover:bg-gold/10 hover:text-gold disabled:opacity-25"
          aria-label={`Make ${player.name} captain`}
        >
          <Crown size={16} />
        </button>
        <button
          type="button"
          onClick={onVice}
          disabled={!starter}
          className="grid h-10 min-h-10 w-10 place-items-center rounded-lg text-muted hover:bg-gold/10 hover:text-gold disabled:opacity-25"
          aria-label={`Make ${player.name} vice-captain`}
        >
          <Star size={16} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`button-secondary min-h-10 px-3 text-xs ${starter ? '!border-emerald/30 !text-emerald' : ''}`}
        >
          {starter ? 'Starter' : 'Add'}
        </button>
      </div>
    </article>
  );
}
