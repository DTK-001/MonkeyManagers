# Scoring

Monkey Managers calculates transparent fantasy points from normalized fixture-player statistics. It does not use API-Football's overall player rating as a score. The evaluator in `src/domain/scoring.ts` is provider-independent and has no React or database dependency.

## Principles

1. Each score references a versioned rule set.
2. Position-specific weights distinguish goalkeepers, defenders, midfielders, and forwards.
3. Missing provider statistics remain missing and contribute no fabricated value.
4. Every non-zero contribution is stored as structured data.
5. Repetitive metrics have low weights and caps so volume cannot overwhelm decisive play.
6. Scores are decimal values rounded to two places; negative match totals are valid.
7. A fixture's enabled competition determines where its points are allocated.

The built-in default is `default-2026.1`. Database-backed rules can replace the default object without changing the evaluator.

## Normalization and missing data

`FixturePlayerStatistics` accepts nullable metrics. For every applicable rule the result lists the metric as either `availableMetrics` or `missingMetrics`. A missing value is not silently treated as a provider-supplied zero.

Only two conservative derivations are currently allowed:

- `appearance` may be derived when positive minutes were supplied;
- `completedPasses` may be rounded from attempts × completion percentage when both inputs were supplied and valid.

Each derived breakdown entry is explicitly marked `source: "derived"`. Touches, possession lost, errors, claims, and similar fields are never invented. A competition should enable an optional metric only after its coverage report shows sufficiently consistent provider support.

## Default rule summary

Weights are points per event unless the calculation column says otherwise. Position values are shown as `GK / DEF / MID / FWD`.

### Participation and decisive actions

| Metric         | Calculation |        Weight | Cap/condition                    |
| -------------- | ----------- | ------------: | -------------------------------- |
| Appearance     | Boolean     |      0.25 all | supplied or derived from minutes |
| Minutes        | Count       |      0.01 all | first 50 minutes                 |
| Started        | Boolean     |      0.25 all | —                                |
| Played 60+     | Threshold   |      1.00 all | at least 60 minutes              |
| Goal           | Count       | 8 / 6 / 5 / 4 | 4 goals                          |
| Assist         | Count       |      3.00 all | 3 assists                        |
| Penalty won    | Count       |      1.00 all | 2                                |
| Penalty missed | Count       |     -2.00 all | 2                                |
| Own goal       | Count       |     -3.00 all | 2                                |

### Shooting, creation, and passing

| Metric                  | Weight GK / DEF / MID / FWD | Cap/condition        |
| ----------------------- | --------------------------: | -------------------- |
| Shots                   |   0.05 / 0.08 / 0.10 / 0.12 | 6                    |
| Shots on target         |   0.15 / 0.20 / 0.25 / 0.30 | 5                    |
| Key passes              |   0.25 / 0.35 / 0.50 / 0.40 | 6                    |
| Successful dribbles     |   0.10 / 0.15 / 0.20 / 0.20 | 5                    |
| Fouls drawn             |                    0.15 all | 4                    |
| Passes attempted        |                   0.002 all | 50                   |
| At least 85% completion |   0.10 / 0.20 / 0.25 / 0.20 | at least 20 attempts |
| Completed passes        |                   0.005 all | 60                   |
| Accurate long passes    |   0.04 / 0.05 / 0.04 / 0.03 | 12                   |

Passing rewards are intentionally small. Even the cap on 50 attempted passes is only 0.10 points, and 60 completed passes are only 0.30 points.

### Defending and goalkeeping

| Metric            | Weight GK / DEF / MID / FWD | Cap/condition                          |
| ----------------- | --------------------------: | -------------------------------------- |
| Tackles           |   0.15 / 0.35 / 0.30 / 0.15 | 6                                      |
| Interceptions     |   0.15 / 0.40 / 0.30 / 0.15 | 5                                      |
| Blocks            |   0.10 / 0.40 / 0.25 / 0.10 | 4                                      |
| Duels won         |   0.05 / 0.10 / 0.12 / 0.10 | 10                                     |
| Aerial duels won  |   0.05 / 0.15 / 0.12 / 0.15 | 8                                      |
| Clearances        |   0.05 / 0.15 / 0.08 / 0.03 | 10                                     |
| Saves             |            0.50 / 0 / 0 / 0 | 8                                      |
| Penalty saves     |            5.00 / 0 / 0 / 0 | 2                                      |
| Goals conceded    |       -1.00 / -1.00 / 0 / 0 | each complete pair; source capped at 6 |
| Clean sheet       |      4.00 / 4.00 / 1.00 / 0 | requires 60 minutes                    |
| Goalkeeper claims |            0.20 / 0 / 0 / 0 | 5                                      |

### Negative actions

| Metric                                  | Weight | Cap |
| --------------------------------------- | -----: | --: |
| Fouls committed                         |  -0.20 |   5 |
| Yellow card                             |  -1.00 |   1 |
| Second-yellow dismissal                 |  -3.00 |   1 |
| Straight red                            |  -4.00 |   1 |
| Penalty conceded                        |  -2.00 |   2 |
| Error leading to goal                   |  -2.00 |   2 |
| Failed dribble                          |  -0.10 |   5 |
| Possession lost, provider supplied only |  -0.03 |  10 |

A zero position weight means “not applicable,” so the metric is not reported as missing for that position.

## Evaluation algorithm

For a player and fixture:

1. Validate that the rule version is non-empty, metrics are unique, and every cap/threshold is valid.
2. Resolve the provider-supplied or explicitly derivable statistic.
3. Skip unavailable or position-inapplicable metrics without inventing zero source data.
4. Apply any companion requirement, such as 60 minutes for a clean sheet.
5. Cap the source value.
6. Apply one of four calculations: boolean, count, threshold, or integer steps.
7. Multiply by the position weight and round the contribution to two decimals.
8. Sum contributions and round the total to two decimals.

Conceptually:

```text
applied = calculation(min(source, cap), threshold, companion)
contribution = round_2(applied × position_weight)
match_total = round_2(sum(contribution))
```

## Structured explanation

Each non-zero `ScoreBreakdownItem` records:

- metric and human label;
- source statistic and source value;
- whether it was provided or derived;
- calculation type;
- applied value and unit points;
- resulting points;
- cap and whether the cap applied;
- threshold and whether it was met;
- companion requirement result.

The database stores the calculated header in `player_match_points` and ordered items in `point_breakdowns`. The header references `scoring_rule_sets`, preserving the exact rule version even after an administrator publishes a later version.

Example display:

```text
Appearance                         +0.25
50 scoring minutes                 +0.50
Started match                      +0.25
Played at least 60 minutes         +1.00
Goal (midfielder)                  +5.00
Assist                             +3.00
Three key passes                   +1.50
Four tackles                       +1.20
Yellow card                        -1.00
Total                              11.70
```

The interface should render from structured items rather than saving only this formatted text.

## Competition allocation and lineup multipliers

`allocatePointsToFixtureCompetitions` joins a calculated performance to the enabled competition assigned to its fixture and rejects ambiguous or missing assignments. Competition totals are aggregated only from selected lineup players for that competition round.

Normal points are earned by effective starters. After a round completes, the deterministic substitution engine replaces non-playing starters in bench order only when the resulting formation remains valid. The default captain multiplier is 1.5. If the captain did not play, an eligible vice-captain receives the multiplier; otherwise no captain bonus is added.

Changing captaincy does not change the underlying `player_match_points`; it changes the fantasy lineup aggregation. This keeps provider performance and manager selection separate.

## Administration and coverage

A new rule set should be inserted with a new version instead of mutating a version already used by a score. Coverage requirements belong with the rule version. Before enabling an optional metric, review observed normalized fields for every enabled competition and season.

Administrative corrections must record the old value, new value, reason, requester, approver, and operation ID. Recalculation should produce a new calculation fingerprint and update derived totals idempotently without deleting audit evidence.

## Tests

Run:

```bash
npm test -- src/test/domain/scoring.test.ts
```

The test suite covers every position, missing/null data, caps, thresholds, conservative derivation, negative scores, rule versions, competition allocation, captaincy, and deterministic substitutions. Add a regression case whenever a provider mapping or scoring rule changes.
