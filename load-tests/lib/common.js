// Shared settings for the k6 scripts. Run them with ./load-tests/run.sh.
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { tagWithCurrentStageIndex } from 'https://jslib.k6.io/k6-utils/1.3.0/index.js';

/** Tags every request of the iteration with the stage it started in (`stage:0`, `stage:1`, …). */
export const tagStage = tagWithCurrentStageIndex;

/** Thresholds that make k6 report the latency of each named stage on its own line. */
export function stageThresholds(stages) {
  return Object.fromEntries(
    Object.entries(stages).map(([index, limit]) => [`http_req_duration{stage:${index}}`, [limit]]),
  );
}

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const API = `${BASE_URL}/api/v1`;

/** Percentiles reported for every latency metric. */
export const TREND_STATS = ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max'];

/** A different client address per shopper, as real traffic behind a proxy would show. */
export function clientAddress(n) {
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255 || 1}`;
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Prints the usual summary and, with RESULT_FILE set, also stores the raw numbers as JSON. */
export function summarize(data) {
  const output = { stdout: textSummary(data, { indent: ' ', enableColors: false }) };
  if (__ENV.RESULT_FILE) {
    output[__ENV.RESULT_FILE] = JSON.stringify(data, null, 2);
  }
  return output;
}
