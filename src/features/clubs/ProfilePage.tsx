import { useState } from 'react';
import { Check, LogOut, Save, Sparkles, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { PageHeader, SectionTitle } from '../../components/ui';
import { formatMoney } from '../../lib/format';
import { supabase } from '../../lib/supabase';

export default function ProfilePage() {
  const { currentClub, state, updateClub, resetDemo } = useDemo();
  const navigate = useNavigate();
  const [club, setClub] = useState({ ...currentClub });
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const squadValue = state.players
    .filter((player) => player.ownershipClubId === currentClub.id)
    .reduce((sum, player) => sum + player.valueMinor, 0);

  async function signOut() {
    setAccountStatus(null);
    if (!supabase) {
      resetDemo();
      navigate('/auth/sign-in', { replace: true });
      return;
    }

    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      resetDemo();
      navigate('/auth/sign-in', { replace: true });
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : 'We could not sign you out.');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Club profile"
        title="Identity & account"
        description="Your badge is generated from simple original geometry and your chosen club colours."
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="glass-card h-fit overflow-hidden">
          <div
            className="grid min-h-80 place-items-center p-6"
            style={{
              background: `radial-gradient(circle at 50% 20%, ${club.accent}25, transparent 60%)`
            }}
          >
            <div className="text-center">
              <ClubBadge {...club} className="mx-auto h-36 w-36" />
              <h2 className="mt-4 font-display text-3xl font-bold">{club.name}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                {club.abbreviation} · {club.stadium}
              </p>
              <p className="mt-4 font-display text-lg italic text-gold">“{club.motto}”</p>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-white/[0.07]">
            <div className="p-4">
              <p className="text-[0.62rem] uppercase tracking-wider text-muted">Total value</p>
              <p className="mt-1 font-display text-xl font-bold">
                {formatMoney(squadValue + club.budgetMinor)}
              </p>
            </div>
            <div className="border-l border-white/[0.07] p-4">
              <p className="text-[0.62rem] uppercase tracking-wider text-muted">Season points</p>
              <p className="mt-1 font-display text-xl font-bold">{club.totalPoints.toFixed(2)}</p>
            </div>
          </div>
        </aside>
        <div className="space-y-6">
          <section className="glass-card p-4 sm:p-6">
            <SectionTitle eyebrow="Fantasy club" title="Club details" />
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field
                label="Club name"
                value={club.name}
                onChange={(value) => setClub({ ...club, name: value })}
              />
              <Field
                label="Abbreviation"
                value={club.abbreviation}
                maxLength={3}
                onChange={(value) => setClub({ ...club, abbreviation: value.toUpperCase() })}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Manager display name"
                value={club.manager}
                onChange={(value) => setClub({ ...club, manager: value })}
              />
              <Field
                label="Stadium"
                value={club.stadium}
                onChange={(value) => setClub({ ...club, stadium: value })}
              />
            </div>
            <div className="mt-4">
              <Field
                label="Club motto"
                value={club.motto}
                onChange={(value) => setClub({ ...club, motto: value })}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['primary', 'Primary'],
                  ['secondary', 'Secondary'],
                  ['accent', 'Accent']
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="subtle-card flex items-center gap-3 p-3">
                  <input
                    type="color"
                    className="h-11 w-11 cursor-pointer rounded-lg border-0 bg-transparent"
                    value={club[key]}
                    onChange={(event) => setClub({ ...club, [key]: event.target.value })}
                  />
                  <span className="text-xs font-semibold">
                    {label}
                    <span className="mt-1 block font-mono text-[0.62rem] uppercase text-muted">
                      {club[key]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => updateClub(club)} className="button-primary">
                <Save size={16} /> Save identity
              </button>
            </div>
          </section>
          <section className="glass-card p-4 sm:p-6">
            <SectionTitle eyebrow="Badge studio" title="Original badge recipe" />
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Shield', 'Classic tapered shield'],
                ['Division', 'Diagonal sash'],
                ['Symbol', 'Initials and star']
              ].map(([label, value]) => (
                <button
                  type="button"
                  key={label}
                  className="subtle-card min-h-24 p-3 text-left hover:border-gold/30"
                >
                  <Sparkles size={16} className="text-gold" />
                  <span className="mt-2 block text-[0.62rem] uppercase tracking-wider text-muted">
                    {label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold">{value}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted">
              <Check size={15} className="mt-0.5 shrink-0 text-emerald" /> Your badge is original
              and avoids copyrighted club branding or player imagery.
            </p>
          </section>
          <section className="glass-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.05] text-muted">
                <UserRound />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Manager profile</p>
                <p className="text-xs text-muted">Private league account</p>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="button-secondary"
              >
                <LogOut size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
            {accountStatus ? (
              <p className="mt-3 text-xs text-danger" role="status">
                {accountStatus}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      <input
        className="field"
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
