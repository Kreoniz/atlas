import type { CountryCode } from "../data/capitals";
import { isCountryCode, type Language } from "./countries";

const storageKey = "atlas.session.v2";
const previousStorageKey = "atlas.session.v1";

type Session = {
  language: Language;
  theme: "dark" | "light";
  countries: CountryCode[];
  autoZoom: boolean;
  showRecent: boolean;
};

export function loadSession(): Session {
  const initial: Session = {
    language: "ru",
    theme: "dark",
    countries: [],
    autoZoom: false,
    showRecent: false,
  };
  try {
    const value = localStorage.getItem(storageKey) ?? localStorage.getItem(previousStorageKey);
    if (!value) return initial;

    const data: Partial<Session> | null = JSON.parse(value);
    return {
      language: data?.language === "en" ? "en" : "ru",
      theme: data?.theme === "light" ? "light" : "dark",
      autoZoom: data?.autoZoom === true,
      showRecent: data?.showRecent === true,
      countries: Array.isArray(data?.countries)
        ? [...new Set(data.countries.filter(isCountryCode))]
        : [],
    };
  } catch {
    return initial;
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // The current round remains usable when browser storage is unavailable.
  }
}
