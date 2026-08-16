import neo4j, { DateTime } from "neo4j-driver";

function neo4j_datetime_to_date(neoDateTime: DateTime) {
  return new Date(
    Date.UTC(
      neo4j.integer.toNumber(neoDateTime.year),
      neo4j.integer.toNumber(neoDateTime.month) - 1,
      neo4j.integer.toNumber(neoDateTime.day),
      neo4j.integer.toNumber(neoDateTime.hour),
      neo4j.integer.toNumber(neoDateTime.minute),
      neo4j.integer.toNumber(neoDateTime.second),
      neo4j.integer.toNumber(neoDateTime.nanosecond) / 1000000,
    ),
  );
}

export function formatRelativeTime(neoDateTime: DateTime) {
  const date = neo4j_datetime_to_date(neoDateTime);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  if (diffInSeconds < 0) {
    return "in the future";
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const count = Math.floor(diffInSeconds / secondsInUnit);

    if (count > 0) {
      if (unit === "second" && count < 10) {
        return "just now";
      }

      const plural = count === 1 ? "" : "s";
      return `${count} ${unit}${plural} ago`;
    }
  }

  return "just now";
}

export function formatTime(neoDateTime: DateTime) {
  const date = neo4j_datetime_to_date(neoDateTime);
  return date.toUTCString();
}

/** Formats the time remaining until a future unix-ms timestamp, e.g. "23h 14m", "42m", "past due". */
export function formatCountdown(targetMs: number, nowMs: number = Date.now()): string {
  const diffInSeconds = Math.floor((targetMs - nowMs) / 1000);
  if (diffInSeconds <= 0) return "past due";

  const days = Math.floor(diffInSeconds / 86400);
  const hours = Math.floor((diffInSeconds % 86400) / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${diffInSeconds}s`;
}