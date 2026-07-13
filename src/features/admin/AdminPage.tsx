import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  CloudCog,
  Database,
  FileClock,
  Gauge,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  X
} from 'lucide-react';
import { useDemo } from '../../app/demo-store';
import { GAME_DEFAULTS } from '../../app/product';
import { formatMoney } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { PageHeader, SectionTitle, StatusBadge } from '../../components/ui';

type AdminSection = 'overview' | 'competitions' | 'scoring' | 'sync' | 'audit';

export default function AdminPage() {
  const { resetDemo, state } = useDemo();
  const [section, setSection] = useState<AdminSection>('overview');
  const [syncConfirm, setSyncConfirm] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'running' | 'complete'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const canRunServerSync = Boolean(supabase && state.selectedLeagueId !== 'league-pending');
  const sections = [
    { id: 'overview', label: 'Settings', icon: Settings2 },
    { id: 'competitions', label: 'Coverage', icon: Trophy },
    { id: 'scoring', label: 'Rules', icon: SlidersHorizontal },
    { id: 'sync', label: 'Data sync', icon: CloudCog },
    { id: 'audit', label: 'Audit log', icon: FileClock }
  ] as const;
  async function runSync() {
    setSyncConfirm(false);
    setSyncState('running');
    setSyncError(null);
    try {
      if (!supabase || !canRunServerSync) {
        window.setTimeout(() => setSyncState('complete'), 1500);
        return;
      }
      const response = await supabase.functions.invoke<unknown>('manual-sync', {
        body: {
          leagueId: state.selectedLeagueId,
          idempotencyKey: crypto.randomUUID()
        }
      });
      if (response.error) throw response.error;
      setSyncState('complete');
    } catch (cause) {
      setSyncState('idle');
      setSyncError(cause instanceof Error ? cause.message : 'The synchronisation could not be started.');
    }
  }
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="League administration"
        title="Control room"
        description="Sensitive changes are validated server-side and written to the audit log."
        action={<StatusBadge kind="success">Admin</StatusBadge>}
      />
      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          className="glass-card flex gap-1 overflow-x-auto p-2 lg:block lg:h-fit"
          aria-label="Admin sections"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold lg:mb-1 lg:w-full ${section === id ? 'bg-white/[0.08] text-gold' : 'text-muted hover:bg-white/[0.04]'}`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div>
          {section === 'overview' ? <SettingsPanel /> : null}
          {section === 'competitions' ? <CoveragePanel /> : null}
          {section === 'scoring' ? <RulesPanel /> : null}
          {section === 'sync' ? (
            <SyncPanel
              state={syncState}
              error={syncError}
              canRunServerSync={canRunServerSync}
              onSync={() => setSyncConfirm(true)}
            />
          ) : null}
          {section === 'audit' ? <AuditPanel /> : null}
        </div>
      </div>
      <section className="mt-7 rounded-2xl border border-danger/20 bg-danger/[0.05] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[#efa4a4]">
              <RotateCcw size={17} />
              <h2 className="text-sm font-bold">Development tools</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              Reset this device’s local view of the league. This does not change the private league
              or its members in Supabase.
            </p>
          </div>
          <button type="button" onClick={resetDemo} className="button-danger">
            Reset local view
          </button>
        </div>
      </section>
      {syncConfirm ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-title"
        >
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-navy p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold">
                <CloudCog />
              </span>
              <button
                type="button"
                onClick={() => setSyncConfirm(false)}
                className="grid h-11 w-11 place-items-center rounded-xl text-muted"
                aria-label="Cancel sync"
              >
                <X size={18} />
              </button>
            </div>
            <p className="eyebrow mt-4">Manual data operation</p>
            <h2 id="sync-title" className="mt-2 font-display text-3xl font-bold">
              Run synchronisation now?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Completed fixtures from the previous three days will be rechecked. The daily
              90-request soft budget still applies and duplicate data will not be created.
            </p>
            {canRunServerSync ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald/20 bg-emerald/[0.06] p-3 text-xs leading-5 text-muted">
                <Check className="mt-0.5 shrink-0 text-emerald" size={15} /> This calls the
                protected Supabase Edge Function. The server independently verifies that you are
                an admin of this league.
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold/20 bg-gold/[0.06] p-3 text-xs leading-5 text-muted">
                <AlertTriangle className="mt-0.5 shrink-0 text-gold" size={15} /> Supabase is not
                connected to an active league, so this device will show a local preview only.
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="button-secondary"
                onClick={() => setSyncConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="button-primary" onClick={() => void runSync()} type="button">
                <Play size={16} /> Sync now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsPanel() {
  return (
    <section className="glass-card p-4 sm:p-6">
      <SectionTitle eyebrow="Season configuration" title="League settings" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Season name" value="2026/27 season" />
        <Field label="Starting budget" value={formatMoney(GAME_DEFAULTS.startingBudgetMinor)} />
        <Field label="Timezone" value="Europe/London" />
        <Field label="Nightly sync" value="03:30" />
        <label>
          <span className="mb-1.5 block text-xs font-semibold">Transfer market</span>
          <select className="field">
            <option>Open</option>
            <option>Paused</option>
            <option>Initial market closed</option>
          </select>
        </label>
        <Field label="Free-agent release" value="90%" />
      </div>
      <div className="mt-5 flex justify-end">
        <button className="button-primary" type="button">
          <Save size={16} /> Save settings
        </button>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      <input className="field" defaultValue={value} />
    </label>
  );
}

const metrics = [
  'Minutes',
  'Goals',
  'Assists',
  'Shots on target',
  'Key passes',
  'Tackles',
  'Interceptions',
  'Saves',
  'Clearances',
  'Possession lost'
];
function CoveragePanel() {
  return (
    <section className="glass-card overflow-hidden">
      <div className="p-4 sm:p-6">
        <SectionTitle eyebrow="Observed provider fields" title="Competition coverage" />
        <p className="text-xs leading-5 text-muted">
          A scoring metric should only be enabled globally when it is consistently observed across
          every active competition.
        </p>
      </div>
      <div className="overflow-x-auto border-t border-white/[0.07]">
        <table className="w-full min-w-[38rem] text-left text-xs">
          <thead className="bg-white/[0.025] text-[0.62rem] uppercase tracking-wider text-muted">
            <tr>
              <th className="p-3">Metric</th>
              <th className="p-3">Crown Premier</th>
              <th className="p-3">Heritage Cup</th>
              <th className="p-3">Continental</th>
              <th className="p-3">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => {
              const partial = metric === 'Clearances' || metric === 'Possession lost';
              return (
                <tr key={metric} className="border-t border-white/[0.07]">
                  <th className="p-3 font-semibold">{metric}</th>
                  <td className="p-3 text-emerald">
                    {partial && index % 2 === 0 ? '82%' : '100%'}
                  </td>
                  <td className={`p-3 ${partial ? 'text-gold' : 'text-emerald'}`}>
                    {partial ? '61%' : '100%'}
                  </td>
                  <td className={`p-3 ${partial ? 'text-gold' : 'text-emerald'}`}>
                    {partial ? '74%' : '98%'}
                  </td>
                  <td className="p-3">
                    {partial ? (
                      <StatusBadge kind="muted">Off</StatusBadge>
                    ) : (
                      <StatusBadge kind="success">On</StatusBadge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2 border-t border-white/[0.07] bg-gold/[0.05] p-4 text-xs leading-5 text-muted">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold" /> Possession lost remains
        nullable and disabled. No missing provider statistic is fabricated.
      </div>
    </section>
  );
}

function RulesPanel() {
  const rules = [
    ['Appearance', '+1.00', '+1.00', '+1.00', '+1.00'],
    ['60+ minutes', '+1.00', '+1.00', '+1.00', '+1.00'],
    ['Goal', '+8.00', '+6.00', '+5.00', '+4.00'],
    ['Assist', '+3.00', '+3.00', '+3.00', '+3.00'],
    ['Clean sheet', '+4.00', '+3.50', '+1.00', '—'],
    ['Yellow card', '−1.00', '−1.00', '−1.00', '−1.00']
  ];
  return (
    <section className="glass-card overflow-hidden">
      <div className="p-4 sm:p-6">
        <SectionTitle eyebrow="Version default-1" title="Scoring rules" />
        <p className="text-xs leading-5 text-muted">
          Decimal weights are applied to normalised fixture statistics and stored with a structured
          point explanation.
        </p>
      </div>
      <div className="overflow-x-auto border-t border-white/[0.07]">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="bg-white/[0.025] text-[0.62rem] uppercase tracking-wider text-muted">
            <tr>
              <th className="p-3">Action</th>
              <th className="p-3">GK</th>
              <th className="p-3">DEF</th>
              <th className="p-3">MID</th>
              <th className="p-3">FWD</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((row) => (
              <tr key={row[0]} className="border-t border-white/[0.07]">
                {row.map((value, index) => (
                  <td
                    key={index}
                    className={`p-3 ${index === 0 ? 'font-semibold' : 'font-mono text-muted'}`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-white/[0.07] p-4">
        <button type="button" className="button-secondary">
          <SlidersHorizontal size={16} /> Create new version
        </button>
      </div>
    </section>
  );
}

function SyncPanel({
  state,
  error,
  canRunServerSync,
  onSync,
}: {
  state: 'idle' | 'running' | 'complete';
  error: string | null;
  canRunServerSync: boolean;
  onSync: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="glass-card p-4 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${state === 'running' ? 'bg-gold/10 text-gold' : 'bg-emerald/10 text-emerald'}`}
          >
            {state === 'running' ? <RefreshCw className="animate-spin" /> : <Check />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Latest scheduled run</p>
            <h2 className="mt-1 font-display text-3xl font-bold">
              {state === 'running'
                ? 'Synchronising…'
                : state === 'complete'
                  ? 'Manual sync complete'
                  : 'Completed successfully'}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {canRunServerSync
                ? 'Server-side import checks the configured league timezone and request budget.'
                : 'Connect Supabase and create or join a league to run the protected server sync.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSync}
            disabled={state === 'running'}
            className="button-primary"
          >
            <RefreshCw size={16} /> Sync now
          </button>
        </div>
      </section>
      {error ? (
        <p
          className="rounded-xl border border-danger/30 bg-danger/[0.08] p-3 text-xs leading-5 text-[#ffc1c1]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStat
          icon={<Gauge />}
          label="Requests used"
          value="12 / 90"
          detail="78 soft-budget calls remain"
        />
        <AdminStat
          icon={<Database />}
          label="Fixtures checked"
          value="12"
          detail="2 provider corrections"
        />
        <AdminStat
          icon={<Activity />}
          label="Records updated"
          value="184"
          detail="0 import errors"
        />
      </div>
      <section className="glass-card p-4">
        <div className="flex items-center gap-2">
          <Clock3 size={17} className="text-gold" />
          <h2 className="text-sm font-bold">Nightly policy</h2>
        </div>
        <ol className="mt-4 space-y-3 text-xs text-muted">
          {[
            'Find completed fixtures and recheck the prior three days.',
            'Normalise player statistics and retain raw provider payloads.',
            'Calculate competition-specific points, tables and player values.',
            'Record API use, errors and a complete idempotent run report.'
          ].map((item, index) => (
            <li key={item} className="flex gap-3">
              <span className="grid h-6 min-h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] font-bold text-gold">
                {index + 1}
              </span>
              <span className="leading-6">{item}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function AdminStat({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="subtle-card p-4">
      <span className="text-gold">{icon}</span>
      <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-[0.65rem] text-muted">{detail}</p>
    </article>
  );
}

function AuditPanel() {
  const records = [
    ['Market reopened', 'Alex Morgan', '10 Jul · 08:15'],
    ['Scoring rules viewed', 'Jamie Chen', '10 Jul · 07:42'],
    ['Nightly sync completed', 'System', '10 Jul · 03:37'],
    ['Invite code renewed', 'Alex Morgan', '9 Jul · 21:04']
  ];
  return (
    <section className="glass-card overflow-hidden">
      <div className="p-4 sm:p-6">
        <SectionTitle eyebrow="Immutable history" title="Audit log" />
      </div>
      <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {records.map(([action, actor, time]) => (
          <div
            key={action}
            className="grid min-h-16 grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]"
          >
            <div>
              <p className="text-sm font-semibold">{action}</p>
              <p className="mt-0.5 text-[0.62rem] text-muted sm:hidden">{actor}</p>
            </div>
            <span className="hidden text-xs text-muted sm:block">{actor}</span>
            <span className="text-right text-xs text-muted">{time}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-white/[0.07] text-xs font-bold text-gold"
      >
        Load full audit history <ChevronRight size={14} />
      </button>
    </section>
  );
}
