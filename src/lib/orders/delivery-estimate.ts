const DELIVERY_TIME_ZONE = 'America/Argentina/Buenos_Aires';

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function dateTimePartsInBuenosAires(date: Date): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DELIVERY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: keyof DateTimeParts) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function partsToUtc(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

export function toBuenosAiresDateTimeLocal(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dateTimePartsInBuenosAires(date);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Parses a datetime-local value as Buenos Aires wall time, independent of the server timezone. */
export function fromBuenosAiresDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const requested: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  if (
    requested.month < 1 ||
    requested.month > 12 ||
    requested.day < 1 ||
    requested.day > 31 ||
    requested.hour < 0 ||
    requested.hour > 23 ||
    requested.minute < 0 ||
    requested.minute > 59
  ) {
    return null;
  }

  const guessedUtc = partsToUtc(requested);
  const guessedLocalParts = dateTimePartsInBuenosAires(new Date(guessedUtc));
  const timezoneOffsetMs = partsToUtc(guessedLocalParts) - guessedUtc;
  const instant = new Date(guessedUtc - timezoneOffsetMs);
  const actual = dateTimePartsInBuenosAires(instant);

  if (
    actual.year !== requested.year ||
    actual.month !== requested.month ||
    actual.day !== requested.day ||
    actual.hour !== requested.hour ||
    actual.minute !== requested.minute
  ) {
    return null;
  }

  return instant;
}

export function sameDeliveryMinute(left: Date | null | undefined, right: Date | null | undefined) {
  if (!left || !right) return left === right;
  return Math.floor(left.getTime() / 60_000) === Math.floor(right.getTime() / 60_000);
}
