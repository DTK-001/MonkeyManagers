import type { PropsWithChildren, ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, Check, Clock3, LoaderCircle } from 'lucide-react';
import clsx from 'clsx';
import type { Position } from '../types';

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="display-title">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function SectionTitle({
  title,
  eyebrow,
  action
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="font-display text-2xl font-bold text-ivory">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
}) {
  return (
    <article className="subtle-card min-w-0 p-4">
      <div className="flex items-center justify-between gap-2 text-muted">
        <span className="truncate text-[0.68rem] font-bold uppercase tracking-[0.16em]">
          {label}
        </span>
        {icon}
      </div>
      <p className="mt-2 truncate font-display text-[1.75rem] font-bold leading-none text-ivory">
        {value}
      </p>
      {hint ? (
        <p
          className={clsx(
            'mt-2 flex items-center gap-1 truncate text-xs',
            trend === 'up' && 'text-emerald',
            trend === 'down' && 'text-danger',
            (!trend || trend === 'neutral') && 'text-muted'
          )}
        >
          {trend === 'up' ? <ArrowUpRight size={13} /> : null}
          {hint}
        </p>
      ) : null}
    </article>
  );
}

export function PositionPill({ position }: { position: Position }) {
  const styles: Record<Position, string> = {
    GK: 'border-gold/35 bg-gold/10 text-[#9af7fa]',
    DEF: 'border-[#9084e6]/35 bg-[#9084e6]/10 text-[#d1cbff]',
    MID: 'border-emerald/35 bg-emerald/10 text-[#a5f3f5]',
    FWD: 'border-danger/35 bg-danger/10 text-[#ffb6db]'
  };
  return (
    <span
      className={clsx(
        'inline-flex rounded-md border px-1.5 py-0.5 text-[0.62rem] font-bold',
        styles[position]
      )}
    >
      {position}
    </span>
  );
}

export function StatusBadge({
  kind,
  children
}: PropsWithChildren<{ kind: 'success' | 'warning' | 'muted' | 'danger' }>) {
  return (
    <span
      className={clsx(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold',
        kind === 'success' && 'border-emerald/30 bg-emerald/10 text-[#a5f3f5]',
        kind === 'warning' && 'border-gold/30 bg-gold/10 text-[#9af7fa]',
        kind === 'muted' && 'border-white/10 bg-white/[0.05] text-muted',
        kind === 'danger' && 'border-danger/30 bg-danger/10 text-[#ffb6db]'
      )}
    >
      {kind === 'success' ? <Check size={12} /> : null}
      {kind === 'warning' ? <Clock3 size={12} /> : null}
      {kind === 'danger' ? <AlertTriangle size={12} /> : null}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('animate-pulse rounded-xl bg-white/[0.07]', className)}
    />
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center text-gold" role="status">
      <LoaderCircle className="animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="subtle-card flex flex-col items-center px-5 py-12 text-center">
      <div className="mb-3 text-gold">{icon}</div>
      <h3 className="font-display text-2xl font-bold text-ivory">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
