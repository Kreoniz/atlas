import { capitals, type CountryCode } from "../data/capitals";

export type Language = "ru" | "en";
export const countryFilters = ["all", "found", "unfound"] as const;
export type CountryFilter = (typeof countryFilters)[number];

export function matchesCountryFilter(filter: CountryFilter, found: boolean) {
  return filter === "all" || (filter === "found") === found;
}

const languages = ["ru", "en"] as const;
const displayNames = {
  ru: new Intl.DisplayNames("ru", { type: "region" }),
  en: new Intl.DisplayNames("en", { type: "region" }),
};

const nameOverrides: Partial<Record<CountryCode, readonly [string, string]>> = {
  CD: ["ДР Конго", "DR Congo"],
  CG: ["Республика Конго", "Republic of the Congo"],
  GB: ["Великобритания", "United Kingdom"],
  PS: ["Палестина", "Palestine"],
  US: ["США", "United States"],
  VA: ["Ватикан", "Vatican City"],
};

const aliases: Partial<Record<CountryCode, readonly string[]>> = {
  AE: ["ОАЭ", "UAE"],
  CD: ["Демократическая Республика Конго", "Democratic Republic of the Congo"],
  CF: ["ЦАР", "CAR"],
  CI: ["Берег Слоновой Кости", "Ivory Coast"],
  CV: ["Острова Зелёного Мыса", "Cape Verde"],
  CZ: ["Чешская Республика", "Czech Republic"],
  GB: ["Соединённое Королевство", "Британия", "Great Britain", "UK"],
  KP: ["КНДР", "DPRK"],
  MK: ["Македония", "Macedonia"],
  MM: ["Бирма", "Burma"],
  NL: ["Голландия", "Holland"],
  RU: ["Российская Федерация", "РФ", "Russian Federation"],
  SZ: ["Свазиленд", "Swaziland"],
  TR: ["Turkey"],
  US: ["Соединённые Штаты Америки", "USA", "United States of America"],
  VA: ["Святой Престол", "Holy See", "Vatican"],
};

export const countryCodes = Object.keys(capitals) as CountryCode[];

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && Object.hasOwn(capitals, value);
}

export function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const countries = countryCodes.map((code) => {
  const names =
    nameOverrides[code] ?? languages.map((language) => displayNames[language].of(code) ?? code);
  const [ru, en] = names;
  const [capitalRu, capitalEn] = capitals[code];
  const capitalTerms = [capitalRu, capitalEn].map((name) => name.replace(/\([^)]*\)/g, ""));
  return {
    code,
    name: { ru, en },
    capital: { ru: capitalRu, en: capitalEn },
    searchTerms: [...names, ...(aliases[code] ?? []), ...capitalTerms].map(normalizeSearch),
  };
});

export const countryByCode = new Map(countries.map((country) => [country.code, country]));

export const countriesByLanguage = Object.fromEntries(
  languages.map((language) => {
    const collator = new Intl.Collator(language);
    return [
      language,
      countries.toSorted((a, b) => collator.compare(a.name[language], b.name[language])),
    ];
  }),
) as Record<Language, typeof countries>;
