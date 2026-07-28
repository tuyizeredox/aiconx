import { formatDistanceToNow } from "date-fns";

// date-fns ships 80+ locales but no Kinyarwanda, so relative timestamps ("2 months
// ago") would stay English for rw users. formatDistanceToNow only ever calls
// locale.formatDistance, so a minimal locale object covering that one function is
// enough — no need to vendor a full date-fns locale.
const RW_DISTANCE = {
  lessThanXSeconds: { one: "munsi y'isegonda rimwe", other: "munsi y'amasegonda {{count}}" },
  xSeconds: { one: "isegonda rimwe", other: "amasegonda {{count}}" },
  halfAMinute: "igice cy'umunota",
  lessThanXMinutes: { one: "munsi y'umunota umwe", other: "munsi y'iminota {{count}}" },
  xMinutes: { one: "umunota umwe", other: "iminota {{count}}" },
  aboutXHours: { one: "hafi y'isaha rimwe", other: "hafi y'amasaha {{count}}" },
  xHours: { one: "isaha rimwe", other: "amasaha {{count}}" },
  xDays: { one: "umunsi umwe", other: "iminsi {{count}}" },
  aboutXWeeks: { one: "hafi y'icyumweru kimwe", other: "hafi y'ibyumweru {{count}}" },
  xWeeks: { one: "icyumweru kimwe", other: "ibyumweru {{count}}" },
  aboutXMonths: { one: "hafi y'ukwezi kumwe", other: "hafi y'amezi {{count}}" },
  xMonths: { one: "ukwezi kumwe", other: "amezi {{count}}" },
  aboutXYears: { one: "hafi y'umwaka umwe", other: "hafi y'imyaka {{count}}" },
  xYears: { one: "umwaka umwe", other: "imyaka {{count}}" },
  overXYears: { one: "hejuru y'umwaka umwe", other: "hejuru y'imyaka {{count}}" },
  almostXYears: { one: "hafi y'umwaka umwe", other: "hafi y'imyaka {{count}}" },
};

const rwLocale = {
  code: "rw",
  formatDistance: (token, count, options) => {
    const entry = RW_DISTANCE[token];
    const result = typeof entry === "string"
      ? entry
      : (count === 1 ? entry.one : entry.other.replace("{{count}}", String(count)));

    if (!options?.addSuffix) return result;
    // "hashize iminota 5" = 5 minutes ago; "hasigaye iminota 5" = in 5 minutes.
    // Both read naturally and avoid the vowel elision "mu iminota" would need.
    return options.comparison > 0 ? `hasigaye ${result}` : `hashize ${result}`;
  },
};

export function timeAgo(date, lang) {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    ...(lang === "rw" ? { locale: rwLocale } : {}),
  });
}
