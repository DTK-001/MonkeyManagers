import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LoadingScreen } from '../components/ui';

const AuthPage = lazy(() => import('../features/auth/AuthPage'));
const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage'));
const HomePage = lazy(() => import('../features/home/HomePage'));
const SquadPage = lazy(() => import('../features/squad/SquadPage'));
const MarketPage = lazy(() => import('../features/market/MarketPage'));
const PlayerPage = lazy(() => import('../features/market/PlayerPage'));
const CompetitionsPage = lazy(() => import('../features/competitions/CompetitionsPage'));
const CompetitionPage = lazy(() => import('../features/competitions/CompetitionPage'));
const LeaguePage = lazy(() => import('../features/leagues/LeaguePage'));
const AdminPage = lazy(() => import('../features/admin/AdminPage'));
const ProfilePage = lazy(() => import('../features/clubs/ProfilePage'));
const OfflinePage = lazy(() => import('../features/system/OfflinePage'));
const NotFoundPage = lazy(() => import('../features/system/NotFoundPage'));

export function App() {
  return (
    <HashRouter>
      <a
        href="#main-content"
        className="sr-only z-[100] bg-ivory p-3 text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Navigate replace to="/auth/sign-in" />} />
          <Route path="/auth/:mode" element={<AuthPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate replace to="home" />} />
            <Route path="home" element={<HomePage />} />
            <Route path="squad" element={<SquadPage />} />
            <Route path="market" element={<MarketPage />} />
            <Route path="market/:playerId" element={<PlayerPage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="competitions/:competitionId" element={<CompetitionPage />} />
            <Route path="league" element={<LeaguePage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
