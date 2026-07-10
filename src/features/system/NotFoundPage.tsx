import { ArrowLeft, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div>
        <Flag className="mx-auto text-gold" size={34} />
        <p className="eyebrow mt-5">Full time</p>
        <h1 className="mt-2 font-display text-6xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-muted">That route has left the pitch.</p>
        <Link className="button-primary mt-6" to="/">
          <ArrowLeft size={17} /> Return home
        </Link>
      </div>
    </main>
  );
}
