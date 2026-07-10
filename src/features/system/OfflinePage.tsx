import { CloudOff, RotateCcw, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
          <CloudOff size={30} />
        </span>
        <p className="eyebrow mt-6">Connection paused</p>
        <h1 className="mt-2 font-display text-5xl font-bold">The floodlights are still on.</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Your saved club and application shell remain available. Market actions and fresh scores
          will resume when you reconnect.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="button-primary mt-6"
        >
          <RotateCcw size={17} /> Try again
        </button>
        <Link to="/app/home" className="button-secondary ml-3 mt-3">
          <Shield size={17} /> Saved dashboard
        </Link>
      </div>
    </main>
  );
}
