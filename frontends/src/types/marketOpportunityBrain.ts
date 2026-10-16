/*
 * AutoFinX V4 Market Opportunity Brain -- read-only research types.
 *
 * Mirrors the JSON contract examples in
 * autofinx-backend/backends/docs/market-opportunity-brain-v4/contracts/*.json and the PHP DTOs in
 * app/Domain/MarketOpportunityBrain/Data/*.php (MASTER_SPEC.md Section M test #23: "schema
 * contract snapshots PHP/Python/TS"). TYPES ONLY -- not imported by any page, route, hook or the
 * sidebar yet. No API client, no fetch call, no UI wiring exists for this module in this phase
 * (PHASES_AND_TEST_GATES.md Phase 1 is contracts/fixtures only; the read-only API/UI is Phase 6).
 *
 * RESEARCH ONLY: `execution_authorized` is always `false` on every one of these shapes; nothing
 * here may ever carry an order field (`quantity`, `leverage`, `api_key`, `order_type`).
 */

export type MobResearchDecision = "LONG_CANDIDATE" | "SHORT_CANDIDATE" | "WAIT" | "REJECT";

export type MobForecastStatus = "OK" | "UNAVAILABLE" | "MODEL_UNAVAILABLE" | "STALE";

export interface MobDiscoveryRecord {
  schema: "mob.discovery.v1";
  snapshot_id: string;
  exchange: string;
  market: string;
  symbol: string;
  workspace_id: string;
  as_of_utc: string;
  last_closed_candle_utc: string | null;
  listed_as_of: boolean;
  eligible_for_analysis: boolean;
  rank: number | null;
  opportunity_score: number | null;
  direction: string | null;
  source_freshness_seconds: number | null;
  reason_codes: string[];
  feature_schema_version: string;
  feature_window_hash_sha256: string | null;
  execution_authorized: false;
}

export interface MobForecastQuantiles {
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export interface MobForecastProbabilities {
  up: number | null;
  neutral: number | null;
  down: number | null;
}

export interface MobForecastRecord {
  schema: "mob.forecast.v1";
  forecast_id: string;
  workspace_id: string;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  horizon_bars: number;
  as_of_utc: string;
  known_by_utc: string;
  label_available_at_utc: string | null;
  model_name: string;
  model_revision: string;
  feature_schema_version: string;
  dataset_hash_sha256: string | null;
  prediction_quantiles: MobForecastQuantiles;
  probabilities: MobForecastProbabilities;
  probability_calibrated: boolean;
  status: MobForecastStatus;
  reason: string | null;
  execution_authorized: false;
}

export interface MobDecisionRecord {
  schema: "mob.decision.v1";
  decision_id: string;
  workspace_id: string;
  exchange: string;
  market: string;
  symbol: string;
  base_timeframe: string;
  horizon_bars: number;
  decision_as_of_utc: string;
  inputs_known_by_utc: string;
  candidate_id: string | null;
  forecast_id: string | null;
  policy_id: string;
  policy_version: string;
  decision: MobResearchDecision;
  directional_bias: string | null;
  reason_codes: string[];
  forecast_calibrated: boolean;
  data_quality: string;
  simulation_cost_profile: string;
  input_hash_sha256: string | null;
  execution_authorized: false;
  mode: "RESEARCH_ONLY";
  realized_live_pnl: number | null;
  hypothetical_net_return: number | null;
  note?: string | null;
}

export interface MobExperimentRecord {
  schema: "mob.experiment.v1";
  experiment_id: string;
  status: string;
  workspace_id: string;
  hypothesis: string;
  registration_sha256: string | null;
  dataset_sha256: string | null;
  universe_policy: string;
  timeframe: string;
  horizon_bars: number;
  arms: string[];
  holdout_policy: string;
  model_revision: string | null;
  cost_profile_version: string | null;
  sample_count: number;
  metrics: Record<string, unknown> | null;
  verdict: string;
  execution_authorized: false;
}
