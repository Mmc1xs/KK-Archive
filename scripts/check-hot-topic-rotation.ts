import assert from "node:assert/strict";
import { getPreviousDateKey, getTaipeiDateKey, selectDailyHotTopicIds } from "../lib/hot-topic";

const candidates = Array.from({ length: 100 }, (_, index) => index + 1);
const dateKey = "2026-08-08";
const today = selectDailyHotTopicIds(candidates, dateKey, 8);
const todayAgain = selectDailyHotTopicIds(candidates, dateKey, 8);
const yesterday = selectDailyHotTopicIds(candidates, getPreviousDateKey(dateKey), 8);

assert.deepEqual(today, todayAgain, "the same Taipei date must return a stable selection");
assert.equal(today.length, 8, "a full candidate pool must return eight posts");
assert.equal(new Set(today).size, 8, "the daily selection must not contain duplicates");
assert.equal(
  today.some((id) => yesterday.includes(id)),
  false,
  "adjacent days must not overlap when the candidate pool is large enough"
);
assert.deepEqual(
  selectDailyHotTopicIds([1, 2, 3], dateKey, 8).sort((left, right) => left - right),
  [1, 2, 3],
  "small candidate pools must return each available post once"
);
assert.equal(getTaipeiDateKey(new Date("2026-08-08T15:59:59.000Z")), "2026-08-08");
assert.equal(getTaipeiDateKey(new Date("2026-08-08T16:00:00.000Z")), "2026-08-09");

let previousSelection: number[] | null = null;
for (let offset = 0; offset < 30; offset += 1) {
  const rollingDateKey = new Date(Date.UTC(2026, 7, 1 + offset)).toISOString().slice(0, 10);
  const selection = selectDailyHotTopicIds(candidates, rollingDateKey, 8);
  assert.equal(selection.length, 8);
  assert.equal(new Set(selection).size, 8);
  if (previousSelection) {
    assert.equal(
      selection.some((id) => previousSelection?.includes(id)),
      false,
      `adjacent selections must not overlap on ${rollingDateKey}`
    );
  }
  previousSelection = selection;
}

console.log("Hot Topic daily rotation checks passed.");
