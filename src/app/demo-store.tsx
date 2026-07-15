import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren
} from 'react';
import { GAME_DEFAULTS } from './product';
import { createInitialDemoState } from '../data/demo';
import type { DemoClub, DemoPlayer, DemoState } from '../types';
import { formatMoney } from '../lib/format';

const STORAGE_KEY = 'monkey-managers-session-v1';

const MAX_STARTERS_BY_POSITION = { GK: 1, DEF: 5, MID: 5, FWD: 3 } as const;

type DemoAction =
  | { type: 'START_SESSION' }
  | { type: 'RESET_DEMO' }
  | { type: 'BUY_PLAYER'; playerId: string }
  | { type: 'RELEASE_PLAYER'; playerId: string }
  | { type: 'TOGGLE_STARTER'; playerId: string }
  | { type: 'SET_CAPTAIN'; playerId: string }
  | { type: 'SET_VICE_CAPTAIN'; playerId: string }
  | { type: 'SAVE_LINEUP'; name: string }
  | { type: 'RESTORE_SAVED_LINEUP'; lineupId?: string }
  | { type: 'SET_ACTIVE_SAVED_LINEUP'; lineupId: string }
  | { type: 'UPDATE_CLUB'; values: Partial<DemoClub> }
  | { type: 'HYDRATE_CLUB'; club: DemoClub; leagueId: string; leagueName: string; resumed: boolean }
  | { type: 'SYNC_SERVER_MARKET'; players: ServerMarketPlayer[]; balanceMinor: number }
  | {
      type: 'COMMIT_SERVER_MARKET_OPERATION';
      playerId: string;
      owned: boolean;
      balanceMinor: number;
    }
  | { type: 'CLEAR_MESSAGE' };

type ServerMarketPlayer = {
  cataloguePlayerId: string;
  realPlayerId: string;
  ownerClubId: string | null;
  valueMinor: number;
  previousValueMinor: number;
  birthDate: string | null;
  nationality: string | null;
};

function activityId(): string {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function reducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'START_SESSION':
      return {
        ...state,
        demoActive: true,
        message: { kind: 'info', text: 'Your private league is ready.' }
      };
    case 'RESET_DEMO':
      return { ...createInitialDemoState(), demoActive: true };
    case 'BUY_PLAYER': {
      const player = state.players.find((item) => item.id === action.playerId);
      const club = state.clubs.find((item) => item.id === state.currentClubId);
      if (!player || !club) return state;
      if (!state.marketOpen) {
        return { ...state, message: { kind: 'error', text: 'The transfer market is paused.' } };
      }
      if (player.ownershipClubId) {
        return {
          ...state,
          message: {
            kind: 'error',
            text: `${player.name} has just been purchased by another club.`
          }
        };
      }
      if (club.budgetMinor < player.valueMinor) {
        return {
          ...state,
          message: { kind: 'error', text: 'This signing would take your balance below zero.' }
        };
      }
      return {
        ...state,
        players: state.players.map((item) =>
          item.id === player.id
            ? {
                ...item,
                ownershipClubId: club.id,
                ownedPoints: 0,
                ownershipStartedAt: new Date().toISOString()
              }
            : item
        ),
        clubs: state.clubs.map((item) =>
          item.id === club.id
            ? { ...item, budgetMinor: item.budgetMinor - player.valueMinor }
            : item
        ),
        bench: state.bench.length < 7 ? [...state.bench, player.id] : state.bench,
        lastLineupSavedAt: null,
        activity: [
          {
            id: activityId(),
            type: 'transfer',
            title: 'Signing confirmed',
            detail: `${club.name} signed ${player.name} for ${formatMoney(player.valueMinor)}.`,
            timestamp: new Date().toISOString()
          },
          ...state.activity
        ],
        message: {
          kind: 'success',
          text: `${player.name} is yours. Earlier season points do not transfer; select them for a future round to start earning for your club.`
        }
      };
    }
    case 'RELEASE_PLAYER': {
      const player = state.players.find((item) => item.id === action.playerId);
      const club = state.clubs.find((item) => item.id === state.currentClubId);
      if (!player || !club || player.ownershipClubId !== club.id) {
        return { ...state, message: { kind: 'error', text: 'You do not own this player.' } };
      }
      const refund = Math.round(player.valueMinor * GAME_DEFAULTS.releasePercentage);
      return {
        ...state,
        players: state.players.map((item) =>
          item.id === player.id
            ? { ...item, ownershipClubId: null, ownershipStartedAt: null }
            : item
        ),
        clubs: state.clubs.map((item) =>
          item.id === club.id ? { ...item, budgetMinor: item.budgetMinor + refund } : item
        ),
        starters: state.starters.filter((id) => id !== player.id),
        bench: state.bench.filter((id) => id !== player.id),
        captainId: state.captainId === player.id ? null : state.captainId,
        viceCaptainId: state.viceCaptainId === player.id ? null : state.viceCaptainId,
        lastLineupSavedAt: null,
        savedLineups: [],
        activeSavedLineupId: null,
        activity: [
          {
            id: activityId(),
            type: 'transfer',
            title: 'Player released',
            detail: `${player.name} returned to the market for ${formatMoney(refund)}.`,
            timestamp: new Date().toISOString()
          },
          ...state.activity
        ],
        message: {
          kind: 'success',
          text: `${formatMoney(refund)} has been returned to your balance. Points already earned for your club remain in your total.`
        }
      };
    }
    case 'TOGGLE_STARTER': {
      const player = state.players.find(
        (item) => item.id === action.playerId && item.ownershipClubId === state.currentClubId
      );
      if (!player) return state;
      if (state.starters.includes(player.id)) {
        return {
          ...state,
          starters: state.starters.filter((id) => id !== player.id),
          bench: state.bench.includes(player.id)
            ? state.bench
            : [...state.bench, player.id].slice(0, 7),
          captainId: state.captainId === player.id ? null : state.captainId,
          viceCaptainId: state.viceCaptainId === player.id ? null : state.viceCaptainId,
          lastLineupSavedAt: null
        };
      }
      if (state.starters.length >= 11) {
        return {
          ...state,
          message: { kind: 'error', text: 'Remove a starter before adding another player.' }
        };
      }
      const positionCount = state.starters.reduce((count, starterId) => {
        const starter = state.players.find((item) => item.id === starterId);
        return count + Number(starter?.position === player.position);
      }, 0);
      if (positionCount >= MAX_STARTERS_BY_POSITION[player.position]) {
        return {
          ...state,
          message: {
            kind: 'error',
            text: `You can select up to ${MAX_STARTERS_BY_POSITION[player.position]} ${player.position} players.`
          }
        };
      }
      return {
        ...state,
        starters: [...state.starters, player.id],
        bench: state.bench.filter((id) => id !== player.id),
        lastLineupSavedAt: null
      };
    }
    case 'SET_CAPTAIN':
      if (!state.starters.includes(action.playerId)) return state;
      return {
        ...state,
        captainId: action.playerId,
        viceCaptainId: state.viceCaptainId === action.playerId ? null : state.viceCaptainId,
        lastLineupSavedAt: null,
        message: { kind: 'success', text: 'Captain updated.' }
      };
    case 'SET_VICE_CAPTAIN':
      if (!state.starters.includes(action.playerId)) return state;
      return {
        ...state,
        viceCaptainId: action.playerId,
        captainId: state.captainId === action.playerId ? null : state.captainId,
        lastLineupSavedAt: null,
        message: { kind: 'success', text: 'Vice-captain updated.' }
      };
    case 'SAVE_LINEUP': {
      if (state.starters.length !== 11) {
        return {
          ...state,
          message: {
            kind: 'error',
            text: `Select 11 starters. You currently have ${state.starters.length}.`
          }
        };
      }
      const positionCounts = state.starters.reduce(
        (counts, starterId) => {
          const player = state.players.find((item) => item.id === starterId);
          if (player) counts[player.position] += 1;
          return counts;
        },
        { GK: 0, DEF: 0, MID: 0, FWD: 0 }
      );
      if (
        positionCounts.GK !== 1 ||
        positionCounts.DEF < 3 ||
        positionCounts.DEF > 5 ||
        positionCounts.MID < 2 ||
        positionCounts.MID > 5 ||
        positionCounts.FWD < 1 ||
        positionCounts.FWD > 3
      ) {
        return {
          ...state,
          message: {
            kind: 'error',
            text: 'Use a valid formation before saving your team.'
          }
        };
      }
      if (!state.captainId || !state.viceCaptainId) {
        return {
          ...state,
          message: { kind: 'error', text: 'Choose both a captain and vice-captain.' }
        };
      }
      const name = action.name.trim();
      if (!name) {
        return { ...state, message: { kind: 'error', text: 'Give this formation a name before saving.' } };
      }
      const savedAt = new Date().toISOString();
      const existingLineup = state.savedLineups.find(
        (lineup) => lineup.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      );
      const savedLineup = {
        id: existingLineup?.id ?? `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        starters: [...state.starters],
        bench: [...state.bench],
        captainId: state.captainId,
        viceCaptainId: state.viceCaptainId,
        savedAt
      };
      return {
        ...state,
        lastLineupSavedAt: savedAt,
        savedLineups: existingLineup
          ? state.savedLineups.map((lineup) => (lineup.id === existingLineup.id ? savedLineup : lineup))
          : [...state.savedLineups, savedLineup],
        activeSavedLineupId: savedLineup.id,
        message: { kind: 'success', text: 'Lineup saved for Crown Premier Division · Round 9.' }
      };
    }
    case 'RESTORE_SAVED_LINEUP': {
      const savedLineup = state.savedLineups.find(
        (lineup) => lineup.id === (action.lineupId ?? state.activeSavedLineupId)
      );
      if (!savedLineup) return state;
      const savedPlayerIds = [
        ...savedLineup.starters,
        ...savedLineup.bench,
        savedLineup.captainId,
        savedLineup.viceCaptainId
      ];
      const hasUnavailablePlayer = savedPlayerIds.some(
        (playerId) =>
          !state.players.some(
            (player) => player.id === playerId && player.ownershipClubId === state.currentClubId
          )
      );
      if (hasUnavailablePlayer) {
        return {
          ...state,
          message: {
            kind: 'error',
            text: 'This saved formation cannot be loaded until your squad has finished syncing.'
          }
        };
      }
      return {
        ...state,
        starters: [...savedLineup.starters],
        bench: [...savedLineup.bench],
        captainId: savedLineup.captainId,
        viceCaptainId: savedLineup.viceCaptainId,
        lastLineupSavedAt: savedLineup.savedAt,
        activeSavedLineupId: savedLineup.id
      };
    }
    case 'SET_ACTIVE_SAVED_LINEUP':
      if (!state.savedLineups.some((lineup) => lineup.id === action.lineupId)) return state;
      return {
        ...state,
        activeSavedLineupId: action.lineupId,
        message: { kind: 'success', text: 'Active formation updated. It will load when you open Squad.' }
      };
    case 'UPDATE_CLUB':
      return {
        ...state,
        clubs: state.clubs.map((club) =>
          club.id === state.currentClubId ? { ...club, ...action.values } : club
        ),
        message: { kind: 'success', text: 'Club identity saved.' }
      };
    case 'HYDRATE_CLUB':
      return {
        ...state,
        demoActive: true,
        selectedLeagueId: action.leagueId,
        leagueName: action.leagueName,
        currentClubId: action.club.id,
        clubs: [action.club],
        competitions: [],
        fixtures: [],
        players: state.players.map((player) => ({
          ...player,
          ownershipClubId: null,
          ownedPoints: 0,
          ownershipStartedAt: null
        })),
        starters: [],
        bench: [],
        captainId: null,
        viceCaptainId: null,
        lastLineupSavedAt: null,
        savedLineups: action.resumed ? state.savedLineups : [],
        activeSavedLineupId: action.resumed ? state.activeSavedLineupId : null,
        activity: [],
        lastUpdated: new Date().toISOString(),
        message: action.resumed
          ? null
          : { kind: 'success', text: 'Club created. Your full starting purse is available.' }
      };
    case 'SYNC_SERVER_MARKET': {
      const serverPlayers = new Map(
        action.players.map((player) => [player.cataloguePlayerId, player])
      );
      const players = state.players.map((player) => {
        const serverPlayer = serverPlayers.get(player.id);
        return serverPlayer
          ? {
              ...player,
              realPlayerId: serverPlayer.realPlayerId,
              ownershipClubId: serverPlayer.ownerClubId,
              valueMinor: serverPlayer.valueMinor,
              previousValueMinor: serverPlayer.previousValueMinor,
              birthDate: serverPlayer.birthDate ?? player.birthDate,
              nationality: serverPlayer.nationality ?? player.nationality
            }
          : player;
      });
      const savedLineup = state.savedLineups.find(
        (lineup) => lineup.id === state.activeSavedLineupId
      );
      const savedPlayerIds = savedLineup
        ? [...savedLineup.starters, ...savedLineup.bench, savedLineup.captainId, savedLineup.viceCaptainId]
        : [];
      const restoredLineup =
        state.starters.length === 0 &&
        savedLineup &&
        savedPlayerIds.every((playerId) =>
          players.some(
            (player) => player.id === playerId && player.ownershipClubId === state.currentClubId
          )
        )
          ? savedLineup
          : null;
      return {
        ...state,
        players,
        clubs: state.clubs.map((club) =>
          club.id === state.currentClubId ? { ...club, budgetMinor: action.balanceMinor } : club
        ),
        starters: restoredLineup ? [...restoredLineup.starters] : state.starters,
        bench: restoredLineup ? [...restoredLineup.bench] : state.bench,
        captainId: restoredLineup ? restoredLineup.captainId : state.captainId,
        viceCaptainId: restoredLineup ? restoredLineup.viceCaptainId : state.viceCaptainId,
        lastLineupSavedAt: restoredLineup ? restoredLineup.savedAt : state.lastLineupSavedAt
      };
    }
    case 'COMMIT_SERVER_MARKET_OPERATION':
      return {
        ...state,
        players: state.players.map((player) =>
          player.id === action.playerId
            ? {
                ...player,
                ownershipClubId: action.owned ? state.currentClubId : null,
                ownershipStartedAt: action.owned ? new Date().toISOString() : null,
                ownedPoints: action.owned ? 0 : player.ownedPoints
              }
            : player
        ),
        clubs: state.clubs.map((club) =>
          club.id === state.currentClubId ? { ...club, budgetMinor: action.balanceMinor } : club
        ),
        starters: action.owned
          ? state.starters
          : state.starters.filter((id) => id !== action.playerId),
        bench: action.owned ? state.bench : state.bench.filter((id) => id !== action.playerId),
        captainId: action.owned || state.captainId !== action.playerId ? state.captainId : null,
        viceCaptainId:
          action.owned || state.viceCaptainId !== action.playerId ? state.viceCaptainId : null,
        lastLineupSavedAt: null,
        savedLineups: action.owned ? state.savedLineups : [],
        activeSavedLineupId: action.owned ? state.activeSavedLineupId : null
      };
    case 'CLEAR_MESSAGE':
      return { ...state, message: null };
  }
}

function loadState(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialDemoState();
    const initial = createInitialDemoState();
    const restored = JSON.parse(stored) as Partial<DemoState>;
    if (!Array.isArray(restored.clubs) || !Array.isArray(restored.players)) return initial;
    const currentClub = restored.clubs.find((club) => club.id === restored.currentClubId);
    const legacySavedLineup = (restored as Partial<DemoState> & { savedLineup?: Record<string, unknown> })
      .savedLineup;
    const legacyLineup =
      legacySavedLineup &&
      Array.isArray(legacySavedLineup.starters) &&
      Array.isArray(legacySavedLineup.bench) &&
      typeof legacySavedLineup.captainId === 'string' &&
      typeof legacySavedLineup.viceCaptainId === 'string' &&
      typeof legacySavedLineup.savedAt === 'string'
        ? {
            id: `lineup-${legacySavedLineup.savedAt}`,
            name: 'Saved team',
            starters: legacySavedLineup.starters as string[],
            bench: legacySavedLineup.bench as string[],
            captainId: legacySavedLineup.captainId,
            viceCaptainId: legacySavedLineup.viceCaptainId,
            savedAt: legacySavedLineup.savedAt
          }
        : null;
    const savedLineups = Array.isArray(restored.savedLineups)
      ? restored.savedLineups
      : legacyLineup
        ? [legacyLineup]
        : [];
    return {
      ...initial,
      ...restored,
      clubs: restored.clubs,
      players: restored.players.map((player) => {
        const storedPlayer = player as Partial<DemoPlayer>;
        return {
          ...player,
          realPlayerId:
            typeof storedPlayer.realPlayerId === 'string' ? storedPlayer.realPlayerId : null,
          ownedPoints: typeof storedPlayer.ownedPoints === 'number' ? storedPlayer.ownedPoints : 0,
          ownershipStartedAt:
            typeof storedPlayer.ownershipStartedAt === 'string'
              ? storedPlayer.ownershipStartedAt
              : null,
          availabilityDetail: storedPlayer.availabilityDetail ?? {
            chanceThisRound: null,
            chanceNextRound: null,
            news: null
          },
          seasonStats: storedPlayer.seasonStats ?? {
            minutes: 0,
            starts: 0,
            goals: 0,
            assists: 0,
            cleanSheets: 0,
            goalsConceded: 0,
            ownGoals: 0,
            penaltiesSaved: 0,
            penaltiesMissed: 0,
            yellowCards: 0,
            redCards: 0,
            saves: 0,
            bonus: 0,
            bps: 0,
            expectedGoals: 0,
            expectedAssists: 0,
            expectedGoalInvolvements: 0,
            expectedGoalsConceded: 0,
            influence: 0,
            creativity: 0,
            threat: 0,
            ictIndex: 0
          },
          marketInterest: storedPlayer.marketInterest ?? {
            selectedByPercent: 0,
            transfersInEvent: 0,
            transfersOutEvent: 0,
            transfersInSeason: 0,
            transfersOutSeason: 0
          }
        };
      }),
      competitions: Array.isArray(restored.competitions)
        ? restored.competitions
        : initial.competitions,
      fixtures: Array.isArray(restored.fixtures) ? restored.fixtures : initial.fixtures,
      starters: Array.isArray(restored.starters) ? restored.starters : initial.starters,
      bench: Array.isArray(restored.bench) ? restored.bench : initial.bench,
      lastLineupSavedAt:
        typeof restored.lastLineupSavedAt === 'string' ? restored.lastLineupSavedAt : null,
      savedLineups,
      activeSavedLineupId:
        typeof restored.activeSavedLineupId === 'string' &&
        savedLineups.some((lineup) => lineup.id === restored.activeSavedLineupId)
          ? restored.activeSavedLineupId
          : savedLineups[0]?.id ?? null,
      activity: Array.isArray(restored.activity) ? restored.activity : initial.activity,
      selectedLeagueId:
        restored.selectedLeagueId && restored.selectedLeagueId !== currentClub?.id
          ? restored.selectedLeagueId
          : initial.selectedLeagueId,
      message: null
    };
  } catch {
    return createInitialDemoState();
  }
}

interface DemoContextValue {
  state: DemoState;
  currentClub: DemoClub;
  startSession: () => void;
  hydrateClub: (club: DemoClub, leagueId: string, leagueName: string, resumed?: boolean) => void;
  resetDemo: () => void;
  buyPlayer: (playerId: string) => void;
  releasePlayer: (playerId: string) => void;
  toggleStarter: (playerId: string) => void;
  setCaptain: (playerId: string) => void;
  setViceCaptain: (playerId: string) => void;
  saveLineup: (name: string) => void;
  restoreSavedLineup: (lineupId?: string) => void;
  setActiveSavedLineup: (lineupId: string) => void;
  updateClub: (values: Partial<DemoClub>) => void;
  clearMessage: () => void;
  syncServerMarket: (players: ServerMarketPlayer[], balanceMinor: number) => void;
  commitServerMarketOperation: (playerId: string, owned: boolean, balanceMinor: number) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);

  const currentClub = state.clubs.find((club) => club.id === state.currentClubId) ?? state.clubs[0];
  if (!currentClub) throw new Error('Demo seed must contain a current club.');

  const startSession = useCallback(() => dispatch({ type: 'START_SESSION' }), []);
  const resetDemo = useCallback(() => dispatch({ type: 'RESET_DEMO' }), []);
  const saveLineup = useCallback((name: string) => dispatch({ type: 'SAVE_LINEUP', name }), []);
  const restoreSavedLineup = useCallback(
    (lineupId?: string) => dispatch({ type: 'RESTORE_SAVED_LINEUP', lineupId }),
    []
  );
  const setActiveSavedLineup = useCallback(
    (lineupId: string) => dispatch({ type: 'SET_ACTIVE_SAVED_LINEUP', lineupId }),
    []
  );
  const clearMessage = useCallback(() => dispatch({ type: 'CLEAR_MESSAGE' }), []);
  const hydrateClub = useCallback(
    (club: DemoClub, leagueId: string, leagueName: string, resumed = false) =>
      dispatch({ type: 'HYDRATE_CLUB', club, leagueId, leagueName, resumed }),
    []
  );
  const syncServerMarket = useCallback(
    (players: ServerMarketPlayer[], balanceMinor: number) =>
      dispatch({ type: 'SYNC_SERVER_MARKET', players, balanceMinor }),
    []
  );
  const commitServerMarketOperation = useCallback(
    (playerId: string, owned: boolean, balanceMinor: number) =>
      dispatch({ type: 'COMMIT_SERVER_MARKET_OPERATION', playerId, owned, balanceMinor }),
    []
  );

  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      currentClub,
      startSession,
      hydrateClub,
      resetDemo,
      buyPlayer: (playerId) => dispatch({ type: 'BUY_PLAYER', playerId }),
      releasePlayer: (playerId) => dispatch({ type: 'RELEASE_PLAYER', playerId }),
      toggleStarter: (playerId) => dispatch({ type: 'TOGGLE_STARTER', playerId }),
      setCaptain: (playerId) => dispatch({ type: 'SET_CAPTAIN', playerId }),
      setViceCaptain: (playerId) => dispatch({ type: 'SET_VICE_CAPTAIN', playerId }),
      saveLineup,
      restoreSavedLineup,
      setActiveSavedLineup,
      updateClub: (values) => dispatch({ type: 'UPDATE_CLUB', values }),
      clearMessage,
      syncServerMarket,
      commitServerMarketOperation
    }),
    [
      state,
      currentClub,
      startSession,
      resetDemo,
      saveLineup,
      restoreSavedLineup,
      setActiveSavedLineup,
      clearMessage,
      hydrateClub,
      syncServerMarket,
      commitServerMarketOperation
    ]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used inside DemoProvider.');
  return context;
}
