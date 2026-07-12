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
  /** Server-side provider identity used by the durable market. */
  realPlayerId: string | null;
  ownershipClubId: string | null;
  /** Points earned only after this player was signed and selected for this club. */
  ownedPoints: number;
  ownershipStartedAt: string | null;
  availability: Availability;
  availabilityDetail: {
    chanceThisRound: number | null;
    chanceNextRound: number | null;
    news: string | null;
  };
  seasonStats: {
    minutes: number;
    starts: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    goalsConceded: number;
    ownGoals: number;
    penaltiesSaved: number;
    penaltiesMissed: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    bonus: number;
    bps: number;
    expectedGoals: number;
    expectedAssists: number;
    expectedGoalInvolvements: number;
    expectedGoalsConceded: number;
    influence: number;
    creativity: number;
    threat: number;
    ictIndex: number;
  };
  marketInterest: {
    selectedByPercent: number;
    transfersInEvent: number;
    transfersOutEvent: number;
    transfersInSeason: number;
    transfersOutSeason: number;
  };
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
