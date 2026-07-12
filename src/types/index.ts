export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Availability = 'available' | 'doubtful' | 'injured' | 'suspended';

export interface DemoTeam {
  id: string;
  name: string;
  shortName: string;
  colour: string;
}

export interface DemoPlayer {
  id: string;
  name: string;
  position: Position;
  teamId: string;
  nationality: string;
  competitionIds: string[];
  valueMinor: number;
  previousValueMinor: number;
  seasonPoints: number;
  recentPoints: number[];
  form: number;
  ownershipClubId: string | null;
  availability: Availability;
  provisional: boolean;
  valueHistory: Array<{ date: string; valueMinor: number }>;
}

export interface DemoClub {
  id: string;
  name: string;
  abbreviation: string;
  manager: string;
  stadium: string;
  motto: string;
  primary: string;
  secondary: string;
  accent: string;
  badgeShape?: 'shield' | 'round' | 'pennant';
  badgePattern?: 'sash' | 'stripes' | 'split';
  badgeSymbol?: 'star' | 'ball' | 'crown';
  budgetMinor: number;
  totalPoints: number;
  latestRoundPoints: number;
  competitionWins: number;
  highestRoundScore: number;
  rank: number;
  form: Array<'W' | 'D' | 'L'>;
}

export interface DemoCompetition {
  id: string;
  name: string;
  shortName: string;
  format: 'league' | 'knockout' | 'european';
  status: string;
  currentRound: string;
  completeness: number;
  colour: string;
}

export interface DemoFixture {
  id: string;
  competitionId: string;
  round: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string;
  status: 'completed' | 'upcoming';
  homeScore?: number;
  awayScore?: number;
}

export interface ActivityItem {
  id: string;
  type: 'transfer' | 'score' | 'value' | 'sync' | 'notice';
  title: string;
  detail: string;
  timestamp: string;
  private?: boolean;
}

export interface DemoState {
  demoActive: boolean;
  selectedLeagueId: string;
  leagueName: string;
  currentClubId: string;
  clubs: DemoClub[];
  players: DemoPlayer[];
  competitions: DemoCompetition[];
  fixtures: DemoFixture[];
  starters: string[];
  bench: string[];
  captainId: string | null;
  viceCaptainId: string | null;
  activity: ActivityItem[];
  lastUpdated: string;
  marketOpen: boolean;
  message: { kind: 'success' | 'error' | 'info'; text: string } | null;
}
