import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Shield, Sparkles, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ClubBadge } from '../../components/ClubBadge';
import { useDemo } from '../../app/demo-store';

const steps = ['League', 'Club', 'Identity', 'Review'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { startDemo, updateClub, currentClub } = useDemo();
  const [step, setStep] = useState(0);
  const [leagueMode, setLeagueMode] = useState<'create' | 'join'>('join');
  const [club, setClub] = useState({ ...currentClub });
  const [inviteCode, setInviteCode] = useState('FRIDAY26');
  const canContinue = useMemo(
    () => club.name.trim().length >= 3 && /^[A-Z]{3}$/.test(club.abbreviation),
    [club]
  );

  function finish() {
    updateClub(club);
    startDemo();
    navigate('/app/market');
  }

  return (
    <main className="min-h-screen px-4 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1rem+var(--safe-top))] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => (step === 0 ? navigate('/') : setStep((value) => value - 1))}
            className="button-secondary px-3"
          >
            <ArrowLeft size={17} /> Back
          </button>
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <Shield size={21} className="text-gold" /> Monkey Managers
          </div>
          <span className="hidden text-xs text-muted sm:block">Club setup</span>
        </header>
        <ol className="my-8 grid grid-cols-4 gap-2" aria-label="Onboarding progress">
          {steps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div className={`h-1 rounded-full ${index <= step ? 'bg-gold' : 'bg-white/10'}`} />
              <span
                className={`mt-2 block truncate text-[0.62rem] font-bold uppercase tracking-wider ${index === step ? 'text-ivory' : 'text-muted'}`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <section className="glass-card overflow-hidden">
          {step === 0 ? (
            <div className="p-5 sm:p-8">
              <p className="eyebrow">Step one</p>
              <h1 className="mt-2 font-display text-4xl font-bold">Find your league</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Create a new private competition or join your friends with an invite code.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      id: 'join',
                      icon: UsersRound,
                      title: 'Join a league',
                      body: 'Use a private code from your league admin.'
                    },
                    {
                      id: 'create',
                      icon: Sparkles,
                      title: 'Create a league',
                      body: 'Become admin and invite your friends.'
                    }
                  ] as const
                ).map(({ id, icon: Icon, title, body }) => (
                  <button
                    key={id}
                    onClick={() => setLeagueMode(id)}
                    type="button"
                    className={`min-h-32 rounded-2xl border p-4 text-left transition ${leagueMode === id ? 'border-gold/50 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}
                  >
                    <Icon size={22} className="text-gold" />
                    <span className="mt-3 block font-display text-xl font-bold">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted">{body}</span>
                  </button>
                ))}
              </div>
              <label className="mt-5 block">
                <span className="mb-1.5 block text-xs font-semibold">
                  {leagueMode === 'join' ? 'Invite code' : 'League name'}
                </span>
                <div className="relative">
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    className="field pr-12"
                    maxLength={leagueMode === 'join' ? 12 : 40}
                  />
                  <Copy
                    className="pointer-events-none absolute right-3 top-3.5 text-muted"
                    size={16}
                  />
                </div>
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid md:grid-cols-[1fr_18rem]">
              <div className="p-5 sm:p-8">
                <p className="eyebrow">Step two</p>
                <h1 className="mt-2 font-display text-4xl font-bold">Name your club</h1>
                <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <label>
                    <span className="mb-1.5 block text-xs font-semibold">Club name</span>
                    <input
                      className="field"
                      value={club.name}
                      onChange={(event) => setClub({ ...club, name: event.target.value })}
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-semibold">Abbreviation</span>
                    <input
                      className="field uppercase"
                      maxLength={3}
                      value={club.abbreviation}
                      onChange={(event) =>
                        setClub({
                          ...club,
                          abbreviation: event.target.value.toUpperCase().replace(/[^A-Z]/g, '')
                        })
                      }
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-semibold">Stadium name</span>
                  <input
                    className="field"
                    value={club.stadium}
                    onChange={(event) => setClub({ ...club, stadium: event.target.value })}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-semibold">
                    Club motto <span className="font-normal text-muted">(optional)</span>
                  </span>
                  <input
                    className="field"
                    value={club.motto}
                    onChange={(event) => setClub({ ...club, motto: event.target.value })}
                  />
                </label>
              </div>
              <Preview club={club} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid md:grid-cols-[1fr_18rem]">
              <div className="p-5 sm:p-8">
                <p className="eyebrow">Step three</p>
                <h1 className="mt-2 font-display text-4xl font-bold">Choose your colours</h1>
                <p className="mt-2 text-sm text-muted">
                  An original badge is generated from your identity. No copied club marks.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
                <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-xs font-semibold">Badge recipe</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Heraldic shield · diagonal sash · initials · single star
                  </p>
                </div>
              </div>
              <Preview club={club} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="p-5 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <ClubBadge {...club} className="h-32 w-32" />
                <p className="eyebrow mt-5">Ready for the market</p>
                <h1 className="mt-2 font-display text-5xl font-bold">{club.name}</h1>
                <p className="mt-2 text-sm text-muted">
                  {club.manager} · {club.stadium}
                </p>
                {club.motto ? (
                  <p className="mt-4 font-display text-xl italic text-gold">“{club.motto}”</p>
                ) : null}
              </div>
              <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  ['League', leagueMode === 'join' ? 'Friday Night Football' : inviteCode],
                  ['Budget', '£100.0m'],
                  ['Market', 'Open']
                ].map(([label, value]) => (
                  <div key={label} className="subtle-card p-3 text-center">
                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <label className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-white/10 p-3 text-left text-xs leading-5 text-muted">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-emerald bg-emerald text-white">
                  <Check size={14} />
                </span>
                I understand that real players can have only one owner inside this private league,
                and lineups lock at the published deadline.
              </label>
            </div>
          ) : null}

          <footer className="flex items-center justify-between border-t border-white/[0.07] bg-ink/30 p-4 sm:px-8">
            <span className="text-xs text-muted">
              {step + 1} of {steps.length}
            </span>
            {step < 3 ? (
              <button
                type="button"
                disabled={step > 0 && !canContinue}
                onClick={() => setStep((value) => value + 1)}
                className="button-primary"
              >
                Continue <ArrowRight size={17} />
              </button>
            ) : (
              <button onClick={finish} type="button" className="button-primary">
                Enter the market <ArrowRight size={17} />
              </button>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
}

function Preview({ club }: { club: ReturnType<typeof useDemo>['currentClub'] }) {
  return (
    <aside className="grid min-h-72 place-items-center border-t border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:border-l md:border-t-0">
      <div className="text-center">
        <p className="eyebrow mb-4">Live preview</p>
        <ClubBadge {...club} className="mx-auto h-32 w-32" />
        <p className="mt-3 font-display text-2xl font-bold">{club.name}</p>
        <p className="mt-1 text-xs uppercase tracking-widest text-muted">{club.abbreviation}</p>
      </div>
    </aside>
  );
}
