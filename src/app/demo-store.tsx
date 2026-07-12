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
import type { DemoClub, DemoState } from '../types';
import { formatMoney } from '../lib/format';

const STORAGE_KEY = 'monkey-managers-session-v1';

type DemoAction =
  | { type: 'START_SESSION' }
  | { type: 'RESET_DEMO' }
  | { type: 'BUY_PLAYER'; playerId: string }
  | { type: 'RELEASE_PLAYER'; playerId: string }
  | { type: 'TOGGLE_STARTER'; playerId: string }
  | { type: 'SET_CAPTAIN'; playerId: string }
  | { type: 'SET_VICE_CAPTAIN'; playerId: string }
  | { type: 'SAVE_LINEUP' }
  | { type: 'UPDATE_CLUB'; values: Partial<DemoClub> }
  | { type: 'HYDRATE_CLUB'; club: DemoClub; leagueName: string }
  | { type: 'CLEAR_MESSAGE' };

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
          item.id === player.id ? { ...item, ownershipClubId: club.id } : item
        ),
        clubs: state.clubs.map((item) =>
          item.id === club.id
            ? { ...item, budgetMinor: item.budgetMinor - player.valueMinor }
            : item
        ),
        bench: state.bench.length < 7 ? [...state.bench, player.id] : state.bench,
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
          text: `${player.name} is yours. ${formatMoney(club.budgetMinor - player.valueMinor)} remains.`
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
          item.id === player.id ? { ...item, ownershipClubId: null } : item
        ),
        clubs: state.clubs.map((item) =>
          item.id === club.id ? { ...item, budgetMinor: item.budgetMinor + refund } : item
        ),
        starters: state.starters.filter((id) => id !== player.id),
        bench: state.bench.filter((id) => id !== player.id),
        captainId: state.captainId === player.id ? null : state.captainId,
        viceCaptainId: state.viceCaptainId === player.id ? null : state.viceCaptainId,
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
          text: `${formatMoney(refund)} has been returned to your balance.`
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
          viceCaptainId: state.viceCaptainId === player.id ? null : state.viceCaptainId
        };
      }
      if (state.starters.length >= 11) {
        return {
          ...state,
          message: { kind: 'error', text: 'Remove a starter before adding another player.' }
        };
      }
      return {
        ...state,
        starters: [...state.starters, player.id],
        bench: state.bench.filter((id) => id !== player.id)
      };
    }
    case 'SET_CAPTAIN':
      if (!state.starters.includes(action.playerId)) return state;
      return {
        ...state,
        captainId: action.playerId,
        viceCaptainId: state.viceCaptainId === action.playerId ? null : state.viceCaptainId,
        message: { kind: 'success', text: 'Captain updated.' }
      };
    case 'SET_VICE_CAPTAIN':
      if (!state.starters.includes(action.playerId)) return state;
      return {
        ...state,
        viceCaptainId: action.playerId,
        captainId: state.captainId === action.playerId ? null : state.captainId,
        message: { kind: 'success', text: 'Vice-captain updated.' }
      };
    case 'SAVE_LINEUP':
      if (state.starters.length !== 11) {
        return {
          ...state,
          message: {
            kind: 'error',
            text: `Select 11 starters. You currently have ${state.starters.length}.`
          }
        };
      }
      if (!state.captainId || !state.viceCaptainId) {
        return {
          ...state,
          message: { kind: 'error', text: 'Choose both a captain and vice-captain.' }
        };
      }
      return {
        ...state,
        message: { kind: 'success', text: 'Lineup saved for Crown Premier Division · Round 9.' }
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
        selectedLeagueId: action.club.id,
        leagueName: action.leagueName,
        currentClubId: action.club.id,
        clubs: [action.club],
        players: state.players.map((player) => ({ ...player, ownershipClubId: null })),
        starters: [],
        bench: [],
        captainId: null,
        viceCaptainId: null,
        activity: [],
        lastUpdated: new Date().toISOString(),
        message: { kind: 'success', text: 'Club created. Your full starting purse is available.' }
      };
    case 'CLEAR_MESSAGE':
      return { ...state, message: null };
  }
}

function loadState(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as DemoState) : createInitialDemoState();
  } catch {
    return createInitialDemoState();
  }
}

interface DemoContextValue {
  state: DemoState;
  currentClub: DemoClub;
  startSession: () => void;
  hydrateClub: (club: DemoClub, leagueName: string) => void;
  resetDemo: () => void;
  buyPlayer: (playerId: string) => void;
  releasePlayer: (playerId: string) => void;
  toggleStarter: (playerId: string) => void;
  setCaptain: (playerId: string) => void;
  setViceCaptain: (playerId: string) => void;
  saveLineup: () => void;
  updateClub: (values: Partial<DemoClub>) => void;
  clearMessage: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);

  const currentClub = state.clubs.find((club) => club.id === state.currentClubId) ?? state.clubs[0];
  if (!currentClub) throw new Error('Demo seed must contain a current club.');

  const startSession = useCallback(() => dispatch({ type: 'START_SESSION' }), []);
  const resetDemo = useCallback(() => dispatch({ type: 'RESET_DEMO' }), []);
  const saveLineup = useCallback(() => dispatch({ type: 'SAVE_LINEUP' }), []);
  const clearMessage = useCallback(() => dispatch({ type: 'CLEAR_MESSAGE' }), []);

  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      currentClub,
      startSession,
      hydrateClub: (club, leagueName) => dispatch({ type: 'HYDRATE_CLUB', club, leagueName }),
      resetDemo,
      buyPlayer: (playerId) => dispatch({ type: 'BUY_PLAYER', playerId }),
      releasePlayer: (playerId) => dispatch({ type: 'RELEASE_PLAYER', playerId }),
      toggleStarter: (playerId) => dispatch({ type: 'TOGGLE_STARTER', playerId }),
      setCaptain: (playerId) => dispatch({ type: 'SET_CAPTAIN', playerId }),
      setViceCaptain: (playerId) => dispatch({ type: 'SET_VICE_CAPTAIN', playerId }),
      saveLineup,
      updateClub: (values) => dispatch({ type: 'UPDATE_CLUB', values }),
      clearMessage
    }),
    [state, currentClub, startSession, resetDemo, saveLineup, clearMessage]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used inside DemoProvider.');
  return context;
}
