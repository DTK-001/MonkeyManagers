import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CloudOff,
  LockKeyhole,
  Shield,
  Smartphone,
  Trophy,
  Users
} from 'lucide-react';
import { PRODUCT } from '../../app/product';
import { useDemo } from '../../app/demo-store';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { startDemo } = useDemo();
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const ready = () => setOfflineReady(true);
    window.addEventListener('app-offline-ready', ready);
    return () => window.removeEventListener('app-offline-ready', ready);
  }, []);

  function enterDemo() {
    startDemo();
    navigate('/app/home');
  }

  return (
    <main className="stadium-glow min-h-screen overflow-hidden px-[max(1rem,var(--safe-left))] pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1rem+var(--safe-top))]">
      <nav
        className="relative z-10 mx-auto flex max-w-7xl items-center justify-between py-2"
        aria-label="Welcome navigation"
      >
        <Link to="/" className="flex min-h-12 items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Shield size={22} />
          </span>
          <span className="font-display text-xl font-bold text-ivory">{PRODUCT.name}</span>
        </Link>
        <Link to="/auth/sign-in" className="button-secondary px-3 sm:px-4">
          Sign in
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 pb-14 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-24 lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.08] px-3 py-1.5 text-xs font-semibold text-[#ddc79f]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" /> Private football ownership,
            reimagined
          </div>
          <h1 className="max-w-3xl font-display text-[clamp(3.6rem,10vw,7.2rem)] font-bold leading-[0.82] tracking-[-0.055em] text-ivory">
            Build your club.
            <br />
            <span className="text-gold">Own the moment.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#bdc5c2] sm:text-lg sm:leading-8">
            One player. One owner. Your private league turns every real-world performance into a
            season of strategy, rivalries and transfer drama.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={enterDemo}
              className="button-primary min-h-12 px-6"
              type="button"
              data-testid="enter-demo"
            >
              Enter demo league <ArrowRight size={18} />
            </button>
            <Link to="/auth/register" className="button-secondary min-h-12 px-6">
              Create an account
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald" /> No account needed for demo
            </span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole size={14} className="text-gold" /> Private by design
            </span>
            <span className="flex items-center gap-1.5">
              {offlineReady ? (
                <CheckCircle2 size={14} className="text-emerald" />
              ) : (
                <CloudOff size={14} />
              )}{' '}
              PWA-ready
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gold/[0.045] blur-2xl" />
          <div className="glass-card relative overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div>
                <p className="eyebrow">Friday Night Football</p>
                <p className="mt-1 font-display text-2xl font-bold">Matchday command</p>
              </div>
              <span className="rounded-full border border-emerald/20 bg-emerald/10 px-2.5 py-1 text-[0.65rem] font-bold text-[#84d2aa]">
                DEMO
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                ['2nd', 'League rank'],
                ['£36.4m', 'Balance'],
                ['72.40', 'Last round']
              ].map(([value, label]) => (
                <div className="rounded-xl bg-white/[0.045] p-3" key={label}>
                  <p className="font-display text-2xl font-bold text-ivory">{value}</p>
                  <p className="mt-1 text-[0.62rem] uppercase tracking-wider text-muted">{label}</p>
                </div>
              ))}
            </div>
            <div className="pitch-lines relative mt-4 h-64 overflow-hidden rounded-2xl border border-white/10">
              <div className="absolute inset-x-5 top-5 grid grid-cols-3 justify-items-center gap-y-5">
                {[
                  'P. Okafor',
                  'N. Rossi',
                  'L. Jatta',
                  'E. Lobo',
                  'C. Foster',
                  'A. Mensah',
                  'J. Carver',
                  'D. Silva',
                  'H. Quinn'
                ].map((name, index) => (
                  <div
                    key={name}
                    className={index < 2 ? (index === 0 ? 'col-start-1' : 'col-start-3') : ''}
                  >
                    <span className="mx-auto grid h-9 w-9 place-items-center rounded-full border-2 border-gold bg-ink text-[0.62rem] font-bold shadow-lg">
                      {name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')}
                    </span>
                    <span className="mt-1 block rounded bg-ink/80 px-1.5 py-0.5 text-center text-[0.52rem] text-ivory">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/15 bg-gold/[0.06] p-3">
              <div className="flex items-center gap-2.5">
                <Trophy size={18} className="text-gold" />
                <div>
                  <p className="text-xs font-semibold">Lineup deadline</p>
                  <p className="text-[0.66rem] text-muted">Saturday · 11:30</p>
                </div>
              </div>
              <span className="text-xs font-bold text-gold">1d 16h</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-3 border-t border-white/[0.07] pt-7 sm:grid-cols-3">
        {[
          {
            icon: Users,
            title: 'Made for your group',
            body: 'Private leagues, invitation codes and multiple clubs with strict privacy.'
          },
          {
            icon: Trophy,
            title: 'Every competition matters',
            body: 'Points stay attached to the league, cup or European match where they were earned.'
          },
          {
            icon: Smartphone,
            title: 'Ready in your pocket',
            body: 'Installable, offline-aware and designed around one-handed matchday use.'
          }
        ].map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-2xl p-4 sm:p-5">
            <Icon className="mb-3 text-gold" size={22} />
            <h2 className="font-display text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
