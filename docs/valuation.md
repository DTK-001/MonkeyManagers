# Dynamic player valuation

Monkey Managers computes an internal fantasy book value; it does not depend on a provider transfer-market estimate. The pure evaluator lives in `src/domain/valuation.ts`, stores money in integer minor units, and returns a structured explanation suitable for both the UI and audit records.

## Default rules

The built-in rule version is `default-2026.1`.

| Setting                                 |        Default |
| --------------------------------------- | -------------: |
| Minimum value                           |          £0.5m |
| Maximum value                           |           £25m |
| Goalkeeper baseline                     |            £4m |
| Defender baseline                       |            £5m |
| Midfielder baseline                     |            £6m |
| Forward baseline                        |            £7m |
| Season performance weight               |            45% |
| Recent form weight                      |            35% |
| Playing-time reliability weight         |            15% |
| Availability weight                     |             5% |
| Recent appearance weights, newest first |  5, 4, 3, 2, 1 |
| Reliable season sample                  |    450 minutes |
| Reliable recent sample                  |    450 minutes |
| Nightly convergence toward target       | 25% of the gap |
| Maximum normal daily movement           |            ±5% |
| Demand weight                           |             0% |

Demand is intentionally disabled: a four-person league is too small for purchases to be a stable signal of football value.

## Inputs

The evaluator receives:

- position;
- current and initial values, when available;
- season performance percentile and season minutes;
- up to five recent appearances, newest first, with performance percentile, minutes, and optional started flag;
- provided or derived playing-time reliability from 0 to 1;
- availability from 0 to 1, or null when unknown;
- an optional administrator override with a required reason.

Percentiles are population-relative values from 0 to 1. Performance percentiles should normally be based on points per 90 among an appropriate position/competition population, with minimum-minute protection before extrapolating.

## Sample-size protection

Season and recent-form percentiles are blended toward neutral (`0.5`) until their minute sample is reliable:

```text
reliability = clamp(sample_minutes / required_minutes, 0, 1)
adjusted = 0.5 + (raw_percentile - 0.5) × reliability
```

A 0.90 percentile derived from only 90 of the required 450 minutes therefore becomes:

```text
0.5 + (0.9 - 0.5) × 0.2 = 0.58
```

This prevents one short substitute appearance from producing an elite target value.

Recent form uses the five newest usable appearances with weights 5:4:3:2:1. Missing appearance percentiles do not become zero; they are omitted from the weighted numerator and denominator. The resulting sample is then blended toward neutral using total observed minutes.

When playing-time reliability is absent, the engine derives a conservative value from recent minutes and starts. When availability is absent, it is neutral rather than “fully fit.”

## Target value

Each component contributes a signed amount around the position baseline. Let `p` be the adjusted percentile, `w` the component weight, `B` the position baseline, `MIN` the floor, and `MAX` the ceiling:

```text
offset = (p - 0.5) × 2
available_range = offset >= 0 ? MAX - B : B - MIN
component_contribution = round(offset × available_range × w)

normal_target = clamp(
  B + season_contribution
    + recent_form_contribution
    + reliability_contribution
    + availability_contribution,
  MIN,
  MAX
)
```

The asymmetric range lets a strong percentile use the headroom above its position baseline, while a weak percentile uses the room down to the floor. Component weights must total exactly 1.

If season performance is missing or has fewer than 450 minutes, the value is marked provisional and the explanation includes the position baseline and observed/required sample.

## Gradual nightly movement

The normal nightly value does not jump to the target:

```text
target_gap = target - previous
proposed_change = round(target_gap × 0.25)
daily_limit = floor(previous × 0.05)
applied_change = clamp(proposed_change, -daily_limit, daily_limit)
current = clamp(previous + applied_change, MIN, MAX)
```

If rounding would produce zero while the target differs, the engine moves by one minor unit. The result states whether the daily cap applied and records both proposed and applied amounts.

Example: a £10m player with a £14m target proposes a £1m move (25% of the £4m gap), but the 5% daily cap limits the new value to £10.5m.

## Administrator overrides

An override supplies a requested target and a non-empty reason. It is still clamped to the global £0.5m–£25m range. By default it follows gradual movement and the daily cap.

An explicitly authorized `bypassDailyCap` correction moves directly to the overridden target. This should be reserved for data corrections, position remapping, or major rule errors and must create an administrator correction and audit record. It is not a routine tuning tool.

## Structured explanation and persistence

The evaluator returns:

- rule version and position;
- initial, previous, normal target, effective target, and current values;
- signed amount and percentage change;
- provisional, cap, and override flags;
- all four component inputs, adjusted percentiles, reliability, source, and signed contribution;
- explanation items for components, provisional status, cap application, and override.

`dynamic_player_values` stores the current snapshot. `player_value_history` adds a dated immutable time-series point and explanation after each completed valuation run. The player profile chart reads that history rather than recalculating past values under current rules.

The nightly sync should value each player at most once for a league season and date. A repeated job reuses its calculation fingerprint or upserts the same dated history record, so retries do not compound movements.

## Percentile population guidance

For stable results:

- compare players primarily within their position;
- use only completed, valid fixture performances from enabled competitions;
- use per-90 values after the sample threshold, not for tiny samples;
- include non-appearances in reliability rather than pretending they were zero-point appearances;
- treat missing availability as neutral;
- recompute population percentiles consistently for the entire nightly batch;
- keep historical values tied to their formula version.

## Tests

Run:

```bash
npm test -- src/test/domain/valuation.test.ts
```

The tests cover defaults, bounds, position baselines, provisional samples, weighted form, missing inputs, convergence, ±5% movement caps, administrator overrides, structured explanations, and exact minor-unit arithmetic. Add a regression test before changing any production rule version.
