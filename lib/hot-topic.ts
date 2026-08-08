const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateKey(date: Date) {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function hashSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function orderIdsByStableScore(ids: number[]) {
  return [...ids].sort((left, right) => {
    const scoreDifference =
      hashSeed(`kk-hot-topic:pool:${left}`) - hashSeed(`kk-hot-topic:pool:${right}`);
    return scoreDifference || left - right;
  });
}

export function getTaipeiDateKey(date = new Date()) {
  return formatDateKey(date);
}

export function getPreviousDateKey(dateKey: string) {
  return new Date(parseDateKey(dateKey).getTime() - DAY_MS).toISOString().slice(0, 10);
}

export function selectDailyHotTopicIds(candidateIds: number[], dateKey: string, count: number) {
  if (!Number.isInteger(count) || count <= 0) {
    return [];
  }

  const uniqueIds = [...new Set(candidateIds.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (left, right) => left - right
  );
  const poolOrder = orderIdsByStableScore(uniqueIds);
  const dayNumber = Math.floor(parseDateKey(dateKey).getTime() / DAY_MS);

  if (uniqueIds.length <= count) {
    return poolOrder;
  }

  const startIndex = ((dayNumber * count) % poolOrder.length + poolOrder.length) % poolOrder.length;
  const selected: number[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    selected.push(poolOrder[(startIndex + offset) % poolOrder.length]);
  }

  return selected;
}
