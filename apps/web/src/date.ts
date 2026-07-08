const JEJU_TIME_ZONE = 'Asia/Seoul';

export function todayInJeju(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: JEJU_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function normalizeTripStartDate(value: unknown): string {
  const today = todayInJeju();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return today;
  }
  return value < today ? today : value;
}
