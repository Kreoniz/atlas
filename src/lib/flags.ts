import type { CountryCode } from "../data/capitals";

const flags = import.meta.glob<string>("/node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true,
  exhaustive: true,
  import: "default",
  query: "?no-inline",
});

export function flagUrl(code: CountryCode) {
  return flags[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`];
}
