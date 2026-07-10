import { describe, expect, it } from 'vitest';

import {
  deriveLineupDeadline,
  isLineupDeadlinePassed,
  isPlayerFixtureLocked,
  resolveAutomaticSubstitutions,
  validateFormation,
  validateLineup,
  validateLineupEdit,
  type FantasyLineup,
  type LineupPlayer,
  type PlayerRoundPerformance
} from '../../domain/lineup';

const player = (playerId: string, position: LineupPlayer['position']): LineupPlayer => ({
  playerId,
  position
});

function standardLineup(): FantasyLineup {
  return {
    competitionId: 'premier-league',
    roundId: 'round-1',
    starters: [
      player('gk-1', 'GK'),
      player('def-1', 'DEF'),
      player('def-2', 'DEF'),
      player('def-3', 'DEF'),
      player('def-4', 'DEF'),
      player('mid-1', 'MID'),
      player('mid-2', 'MID'),
      player('mid-3', 'MID'),
      player('mid-4', 'MID'),
      player('fwd-1', 'FWD'),
      player('fwd-2', 'FWD')
    ],
    bench: [
      player('mid-5', 'MID'),
      player('gk-2', 'GK'),
      player('def-5', 'DEF'),
      player('fwd-3', 'FWD')
    ],
    captainPlayerId: 'fwd-1',
    viceCaptainPlayerId: 'mid-1'
  };
}

function performances(
  lineup: FantasyLineup,
  overrides: Readonly<Record<string, Partial<PlayerRoundPerformance>>> = {}
): readonly PlayerRoundPerformance[] {
  return [...lineup.starters, ...lineup.bench].map((selected) => ({
    playerId: selected.playerId,
    didPlay: true,
    points: 1,
    ...overrides[selected.playerId]
  }));
}

describe('lineup and formation validation', () => {
  it('accepts a valid eleven and all documented outfield boundaries', () => {
    const lineup = standardLineup();
    expect(validateLineup(lineup).valid).toBe(true);

    const threeFiveTwo = [
      player('g', 'GK'),
      ...[1, 2, 3].map((id) => player(`d${id}`, 'DEF')),
      ...[1, 2, 3, 4, 5].map((id) => player(`m${id}`, 'MID')),
      player('f1', 'FWD'),
      player('f2', 'FWD')
    ];
    expect(validateFormation(threeFiveTwo).valid).toBe(true);
  });

  it('rejects missing goalkeepers and position counts outside 3-5/2-5/1-3', () => {
    const lineup = standardLineup();
    const noGoalkeeper = lineup.starters.map((selected) =>
      selected.position === 'GK' ? { ...selected, position: 'MID' as const } : selected
    );
    const result = validateFormation(noGoalkeeper);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'POSITION_MINIMUM', position: 'GK' })
      ])
    );

    const twoDefenders = lineup.starters.map((selected, index) =>
      selected.position === 'DEF' && index < 3
        ? { ...selected, position: 'MID' as const }
        : selected
    );
    expect(validateFormation(twoDefenders).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'POSITION_MINIMUM', position: 'DEF' })
      ])
    );
  });

  it('validates bench size, ownership, duplicates, captain and vice-captain', () => {
    const base = standardLineup();
    const invalid: FantasyLineup = {
      ...base,
      bench: [
        ...base.bench,
        player('sub-5', 'MID'),
        player('sub-6', 'DEF'),
        player('sub-7', 'FWD'),
        player('def-1', 'DEF')
      ],
      captainPlayerId: 'not-a-starter',
      viceCaptainPlayerId: 'not-a-starter'
    };
    const eligible = [...base.starters, ...base.bench].map((selected) => selected.playerId);
    const result = validateLineup(invalid, { eligiblePlayerIds: eligible });
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'BENCH_SIZE',
        'DUPLICATE_PLAYER',
        'INELIGIBLE_PLAYER',
        'CAPTAIN_NOT_STARTER',
        'VICE_CAPTAIN_NOT_STARTER',
        'CAPTAIN_AND_VICE_SAME'
      ])
    );
  });
});

describe('lineup locking', () => {
  const before = '2026-08-15T14:30:00.000Z';
  const deadline = '2026-08-15T15:00:00.000Z';
  const after = '2026-08-15T15:30:00.000Z';

  it('derives the normal deadline from the first valid fixture kickoff', () => {
    expect(
      deriveLineupDeadline(['2026-08-15T17:30:00.000Z', null, '2026-08-15T15:00:00.000Z'])
    ).toBe('2026-08-15T15:00:00.000Z');
    expect(isLineupDeadlinePassed(before, deadline)).toBe(false);
    expect(isLineupDeadlinePassed(deadline, deadline)).toBe(true);
  });

  it('allows edits before the deadline', () => {
    const previous = standardLineup();
    const next = {
      ...previous,
      starters: previous.starters.map((selected) =>
        selected.playerId === 'mid-4' ? player('mid-5', 'MID') : selected
      ),
      bench: previous.bench.map((selected) =>
        selected.playerId === 'mid-5' ? player('mid-4', 'MID') : selected
      )
    };
    expect(
      validateLineupEdit(previous, next, {
        now: before,
        deadlineAt: deadline,
        playerFixtures: []
      })
    ).toMatchObject({ valid: true, deadlinePassed: false });
  });

  it('locks only players whose relevant fixture has started in rolling-lock mode', () => {
    const previous = standardLineup();
    const next: FantasyLineup = {
      ...previous,
      starters: previous.starters.map((selected) =>
        selected.playerId === 'def-1'
          ? player('def-5', 'DEF')
          : selected.playerId === 'mid-4'
            ? player('mid-5', 'MID')
            : selected
      ),
      bench: previous.bench.map((selected) =>
        selected.playerId === 'def-5'
          ? player('def-1', 'DEF')
          : selected.playerId === 'mid-5'
            ? player('mid-4', 'MID')
            : selected
      )
    };
    const result = validateLineupEdit(previous, next, {
      now: after,
      deadlineAt: deadline,
      playerFixtures: [
        { playerId: 'def-1', kickoffAt: deadline, status: 'in_progress' },
        { playerId: 'def-5', kickoffAt: deadline, status: 'in_progress' },
        {
          playerId: 'mid-4',
          kickoffAt: '2026-08-16T14:00:00.000Z',
          status: 'scheduled'
        },
        {
          playerId: 'mid-5',
          kickoffAt: '2026-08-16T14:00:00.000Z',
          status: 'scheduled'
        }
      ]
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.playerId)).toEqual(['def-1', 'def-5']);
    expect(result.lockedPlayerIds).not.toContain('mid-4');
  });

  it('supports an admin-configured hard round deadline', () => {
    const previous = standardLineup();
    const next = { ...previous, captainPlayerId: 'mid-1', viceCaptainPlayerId: 'fwd-1' };
    expect(
      validateLineupEdit(previous, next, {
        now: after,
        deadlineAt: deadline,
        playerFixtures: [],
        hardLockAtDeadline: true
      })
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'ROUND_LOCKED' }]
    });
  });

  it('does not lock postponed fixtures merely because kickoff time passed', () => {
    expect(
      isPlayerFixtureLocked({ playerId: 'p', kickoffAt: deadline, status: 'postponed' }, after)
    ).toBe(false);
  });
});

describe('deterministic automatic substitutions and captaincy', () => {
  it('uses bench order while preserving a valid formation', () => {
    const lineup = standardLineup();
    const result = resolveAutomaticSubstitutions(
      lineup,
      performances(lineup, {
        'def-1': { didPlay: false, points: 0 }
      })
    );
    // mid-5 would leave only three defenders? In this 4-4-2, 3-5-2 is valid,
    // so the first bench player is the deterministic replacement.
    expect(result.substitutions).toEqual([
      {
        starterOutPlayerId: 'def-1',
        benchInPlayerId: 'mid-5',
        benchIndex: 0,
        starterSlot: 1
      }
    ]);
    expect(result.effectiveStarters[1]?.player.playerId).toBe('mid-5');
  });

  it('skips an earlier bench player when that swap would break formation', () => {
    const base = standardLineup();
    const threeDefenderLineup: FantasyLineup = {
      ...base,
      starters: base.starters.map((selected) =>
        selected.playerId === 'def-4'
          ? { ...selected, position: 'MID' as const, playerId: 'mid-extra' }
          : selected
      ),
      bench: [player('mid-5', 'MID'), player('def-5', 'DEF')]
    };
    const result = resolveAutomaticSubstitutions(
      threeDefenderLineup,
      performances(threeDefenderLineup, {
        'def-1': { didPlay: false, points: 0 }
      })
    );
    expect(result.substitutions[0]?.benchInPlayerId).toBe('def-5');
    expect(validateFormation(result.effectiveStarters.map((item) => item.player)).valid).toBe(true);
  });

  it('replaces a goalkeeper only with the first playing valid goalkeeper', () => {
    const lineup = standardLineup();
    const result = resolveAutomaticSubstitutions(
      lineup,
      performances(lineup, {
        'gk-1': { didPlay: false, points: 0 },
        'mid-5': { didPlay: true, points: 8 },
        'gk-2': { didPlay: true, points: 6 }
      })
    );
    expect(result.substitutions[0]?.benchInPlayerId).toBe('gk-2');
  });

  it('scores only the effective eleven and applies the default 1.5 captain multiplier', () => {
    const lineup = standardLineup();
    const result = resolveAutomaticSubstitutions(
      lineup,
      performances(lineup, {
        'fwd-1': { points: 10 },
        'mid-5': { points: 50 }
      })
    );
    // Ten other starters score one each; an unused bench score is ignored.
    expect(result.basePoints).toBe(20);
    expect(result.captainAppliedToPlayerId).toBe('fwd-1');
    expect(result.captainBonusPoints).toBe(5);
    expect(result.totalPoints).toBe(25);
  });

  it('promotes a playing vice-captain when the captain did not play', () => {
    const lineup = standardLineup();
    const result = resolveAutomaticSubstitutions(
      lineup,
      performances(lineup, {
        'fwd-1': { didPlay: false, points: 0 },
        'mid-1': { didPlay: true, points: 8 },
        'mid-5': { didPlay: true, points: 4 }
      })
    );
    expect(result.substitutions[0]).toMatchObject({
      starterOutPlayerId: 'fwd-1',
      benchInPlayerId: 'mid-5'
    });
    expect(result.captainAppliedToPlayerId).toBe('mid-1');
    expect(result.viceCaptainActivated).toBe(true);
    expect(result.captainBonusPoints).toBe(4);
  });

  it('awards no multiplier when neither captain nor vice-captain played', () => {
    const lineup = standardLineup();
    const result = resolveAutomaticSubstitutions(
      lineup,
      performances(lineup, {
        'fwd-1': { didPlay: false, points: 0 },
        'mid-1': { didPlay: false, points: 0 }
      })
    );
    expect(result.captainAppliedToPlayerId).toBeNull();
    expect(result.captainBonusPoints).toBe(0);
  });
});
