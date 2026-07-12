import type {
  ActivityItem,
  DemoClub,
  DemoCompetition,
  DemoFixture,
  DemoPlayer,
  DemoState,
  DemoTeam
} from '../types';
import { realPremierPlayers, realPremierTeams } from './premier-2024';

// The player catalogue is real Premier League data. League progress is deliberately empty until
// this private league has genuine members, transfers, fixtures, and scored rounds.
export const demoTeams: DemoTeam[] = realPremierTeams;
export const demoPlayers = realPremierPlayers.map((player) => ({
  ...player,
  ownershipClubId: null
})) as DemoPlayer[];
export const demoCompetitions: DemoCompetition[] = [];
export const demoFixtures: DemoFixture[] = [];
export const demoActivity: ActivityItem[] = [];

export const demoClubs: DemoClub[] = [
  {
    id: 'club-pending',
    name: 'Your Club',
    abbreviation: 'YFC',
    manager: 'Manager',
    stadium: 'Home Ground',
    motto: '',
    primary: '#1f1d36',
    secondary: '#10e5eb',
    accent: '#da107b',
    budgetMinor: 0,
    totalPoints: 0,
    latestRoundPoints: 0,
    competitionWins: 0,
    highestRoundScore: 0,
    rank: 0,
    form: []
  }
];

export const createInitialDemoState = (): DemoState => ({
  demoActive: false,
  selectedLeagueId: 'league-pending',
  leagueName: 'Private league',
  currentClubId: 'club-pending',
  clubs: demoClubs,
  players: demoPlayers,
  competitions: demoCompetitions,
  fixtures: demoFixtures,
  starters: [],
  bench: [],
  captainId: null,
  viceCaptainId: null,
  activity: demoActivity,
  lastUpdated: new Date().toISOString(),
  marketOpen: true,
  message: null
});
