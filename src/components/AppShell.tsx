import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleGauge,
  Home,
  Shield,
  ShoppingBag,
  Trophy,
  UsersRound,
  X
} from 'lucide-react';
import clsx from 'clsx';
import { PRODUCT } from '../app/product';
import { useDemo } from '../app/demo-store';
import { ClubBadge } from './ClubBadge';
import { relativeTime } from '../lib/format';

const primaryNav = [
  { to: '/app/home', label: 'Home', icon: Home },
  { to: '/app/squad', label: 'Squad', icon: Shield },
  { to: '/app/market', label: 'Market', icon: ShoppingBag },
  { to: '/app/competitions', label: 'Competitions', shortLabel: 'Cups', icon: Trophy },
  { to: '/app/league', label: 'League', icon: UsersRound }
];

export function AppShell() {
  const { state, currentClub, clearMessage } = useDemo();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    if (!state.message) return undefined;
    const timeout = window.setTimeout(clearMessage, 4200);
    return () => window.clearTimeout(timeout);
  }, [state.message, clearMessage]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-white/[0.07] bg-ink/95 px-4 pb-5 pt-[calc(1.25rem+var(--safe-top))] backdrop-blur-xl lg:flex">
        <NavLink to="/app/home" className="mb-7 flex min-h-12 items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Shield size={22} />
          </span>
          <span>
            <span className="block font-display text-xl font-bold leading-none text-ivory">
              {PRODUCT.name}
            </span>
            <span className="mt-1 block text-[0.6rem] font-bold uppercase tracking-[0.2em] text-gold">
              Private league
            </span>
          </span>
        </NavLink>

        <button
          className="subtle-card mb-5 flex min-h-16 items-center gap-3 px-3 text-left"
          type="button"
          aria-label="Switch private league"
        >
          <ClubBadge {...currentClub} className="h-11 w-11 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-muted">{state.leagueName}</span>
            <span className="block truncate text-sm font-semibold text-ivory">
              {currentClub.name}
            </span>
          </span>
          <ChevronDown size={15} className="text-muted" />
        </button>

        <nav className="space-y-1" aria-label="Primary navigation">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition',
                  isActive
                    ? 'bg-white/[0.08] text-ivory'
                    : 'text-muted hover:bg-white/[0.04] hover:text-ivory'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={19} className={isActive ? 'text-gold' : ''} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-1">
          <NavLink
            to="/app/admin"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-white/[0.04] hover:text-ivory"
          >
            <CircleGauge size={18} /> Administration
          </NavLink>
          <NavLink
            to="/app/profile"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-white/[0.04] hover:text-ivory"
          >
            <BarChart3 size={18} /> Club profile
          </NavLink>
          <p className="px-3 pt-3 text-[0.65rem] text-muted/60">
            Data updated {relativeTime(state.lastUpdated)}
          </p>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex min-h-[calc(4rem+var(--safe-top))] items-end justify-between border-b border-white/[0.06] bg-ink/85 px-[max(1rem,var(--safe-left))] pb-2.5 pt-[calc(.5rem+var(--safe-top))] backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <ClubBadge {...currentClub} className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gold">
              Private league
              </p>
              <p className="truncate text-sm font-semibold text-ivory">{currentClub.name}</p>
            </div>
          </div>
          <div className="hidden lg:block">
            <p className="text-xs text-muted">{state.leagueName}</p>
            <p className="text-sm font-semibold text-ivory">2026/27 season</p>
          </div>
          <div className="flex items-center gap-1.5">
            <NavLink
              to="/app/admin"
              className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-white/[0.05] hover:text-ivory"
              aria-label="Notifications and admin status"
            >
              <Bell size={19} />
            </NavLink>
          </div>
        </header>

        <main id="main-content">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-ink/95 px-[max(.35rem,var(--safe-left))] pb-[var(--safe-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
        aria-label="Primary mobile navigation"
      >
        {primaryNav.map(({ to, label, shortLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-xl text-[0.61rem] font-semibold transition',
                isActive ? 'text-gold' : 'text-muted'
              )
            }
          >
            <Icon size={20} strokeWidth={1.9} />
            <span>{shortLabel ?? label}</span>
          </NavLink>
        ))}
      </nav>

      {state.message ? (
        <div
          className={clsx(
            'toast-enter fixed bottom-[calc(5.3rem+var(--safe-bottom))] left-1/2 z-50 flex w-[min(90vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl lg:bottom-6',
            state.message.kind === 'success' && 'border-emerald/30 bg-[#0c2f27]/95 text-[#bcebd3]',
            state.message.kind === 'error' && 'border-danger/30 bg-[#3b171c]/95 text-[#ffc1c1]',
            state.message.kind === 'info' && 'border-gold/30 bg-[#2a251b]/95 text-[#eee0c4]'
          )}
          role="status"
        >
          <p className="flex-1 leading-5">{state.message.text}</p>
          <button
            onClick={clearMessage}
            type="button"
            className="grid h-8 min-h-8 w-8 place-items-center rounded-lg"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
