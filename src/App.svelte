<script lang="ts">
  import { Globe2, Moon, RotateCcw, Search, Sun, X } from "@lucide/svelte";
  import type { CountryCode } from "./data/capitals";
  import {
    countriesByLanguage,
    countryCodes,
    countryFilters,
    matchesCountryFilter,
    normalizeSearch,
    type CountryFilter,
  } from "./lib/countries";
  import { flagUrl } from "./lib/flags";
  import { messages } from "./lib/messages";
  import { loadSession, saveSession } from "./lib/session";
  import WorldMap from "./lib/WorldMap.svelte";

  const session = $state(loadSession());
  let query = $state("");
  let filter = $state<CountryFilter>("all");
  let flagPreview = $state<{ src: string; x: number; y: number }>();
  let searchInput: HTMLInputElement;
  let list: HTMLDivElement;
  let resetDialog: HTMLDialogElement;
  let map: ReturnType<typeof WorldMap>;

  const t = $derived(messages[session.language]);
  const markedCountries = $derived(new Set(session.countries));
  const searchTerm = $derived(normalizeSearch(query));
  const recentCountry = $derived(session.showRecent ? session.countries.at(-1) : undefined);
  const results = $derived(
    countriesByLanguage[session.language].filter(({ code, searchTerms }) =>
      matchesCountryFilter(filter, markedCountries.has(code)) &&
      (!searchTerm || searchTerms.some((name) => name.includes(searchTerm))),
    ),
  );

  $effect(() => {
    document.documentElement.lang = session.language;
    document.documentElement.dataset.theme = session.theme;
    document.title = t.title;
    saveSession(session);
  });

  function setMarked(code: CountryCode, checked: boolean) {
    const values = new Set(session.countries);
    if (checked) values.add(code);
    else values.delete(code);
    session.countries = [...values];
    if (checked && session.autoZoom) map.focusCountry(code);
  }

  function markFromRow(code: CountryCode, input: HTMLInputElement) {
    if (input.matches(":focus-visible") && !matchesCountryFilter(filter, input.checked)) {
      searchInput.focus({ preventScroll: true });
    }
    setMarked(code, input.checked);
  }

  function selectFilter(next: CountryFilter) {
    filter = next;
    resetListPosition();
  }

  function markFirstResult(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || !searchTerm) return;

    const firstResult = results[0];
    if (!firstResult || markedCountries.has(firstResult.code)) return;

    event.preventDefault();
    setMarked(firstResult.code, true);
  }

  function showFlag(event: PointerEvent & { currentTarget: HTMLImageElement }) {
    if (event.pointerType === "touch") return;

    const flag = event.currentTarget;
    const rect = flag.getBoundingClientRect();
    const width = 128;
    const height = 96;
    const gap = 8;
    const left = rect.left - width - gap;
    const right = rect.right + gap;
    const x = left >= gap ? left : right;
    const y = rect.top + (rect.height - height) / 2;
    flagPreview = {
      src: flag.src,
      x: Math.max(gap, Math.min(x, window.innerWidth - width - gap)),
      y: Math.max(gap, Math.min(y, window.innerHeight - height - gap)),
    };
  }

  function hideFlag() {
    flagPreview = undefined;
  }

  function resetListPosition() {
    hideFlag();
    list.scrollTop = 0;
  }

  function clearSearch() {
    query = "";
    resetListPosition();
    searchInput.focus();
  }

  function openResetDialog() {
    if (!markedCountries.size) return;

    hideFlag();
    resetDialog.returnValue = "";
    resetDialog.showModal();
  }

  function finishReset() {
    if (resetDialog.returnValue === "reset") session.countries = [];
  }

  function handleKeydown(event: KeyboardEvent) {
    if (resetDialog.open) return;

    if (event.key === "Escape" && query && !event.defaultPrevented && !event.isComposing) {
      event.preventDefault();
      clearSearch();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onscroll={hideFlag} onresize={hideFlag} />

<div class="shell">
  <header class="topbar">
    <h1 class="brand">
      <span class="brand-icon"><Globe2 size={19} strokeWidth={1.7} /></span>
      {t.title}
    </h1>
    <div class="progress">
      <div class="progress-tally" aria-live="polite" aria-atomic="true">
        <span class="progress-label">{t.markedCountries}</span>
        <span class="progress-value">{markedCountries.size}<span class="progress-total"> / {countryCodes.length}</span></span>
      </div>
      <button
        type="button"
        class="icon-button reset-trigger"
        aria-label={t.resetProgress}
        title={t.resetProgress}
        aria-disabled={!markedCountries.size}
        onclick={openResetDialog}
      >
        <RotateCcw size={15} />
        <span class="reset-label">{t.reset}</span>
      </button>
    </div>
    <div class="settings">
      <div class="language-switch" role="group" aria-label={t.language}>
        <button type="button" lang="ru" aria-label="Русский" aria-pressed={session.language === "ru"} onclick={() => (session.language = "ru")}>RU</button>
        <button type="button" lang="en" aria-label="English" aria-pressed={session.language === "en"} onclick={() => (session.language = "en")}>EN</button>
      </div>
      <button
        type="button"
        class="icon-button theme-button"
        aria-label={session.theme === "dark" ? t.toLight : t.toDark}
        title={session.theme === "dark" ? t.toLight : t.toDark}
        onclick={() => (session.theme = session.theme === "dark" ? "light" : "dark")}
      >
        {#if session.theme === "dark"}<Sun size={18} />{:else}<Moon size={18} />{/if}
      </button>
    </div>
  </header>

  <main class="workspace">
    <section class="atlas-panel list-panel" aria-label={t.countryList}>
      <div class="list-header">
        <div class="search">
          <Search size={17} />
          <input
            type="text"
            enterkeyhint="search"
            autocomplete="off"
            spellcheck="false"
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            bind:this={searchInput}
            bind:value={query}
            oninput={resetListPosition}
            onkeydown={markFirstResult}
          />
          {#if query}
            <button class="icon-button clear-button" type="button" aria-label={t.clearSearch} title={t.clearSearch} onclick={clearSearch}>
              <X size={17} />
            </button>
          {/if}
        </div>
        <div class="country-filters" role="group" aria-label={t.filterLabel}>
          {#each countryFilters as mode (mode)}
            <button type="button" aria-pressed={filter === mode} onclick={() => selectFilter(mode)}>
              {t.filters[mode]}
            </button>
          {/each}
        </div>
      </div>

      <div class="results" bind:this={list} onscroll={hideFlag}>
        {#if results.length}
          <ul class="country-list">
            {#each results as country (country.code)}
              {@const name = country.name[session.language]}
              <li>
                <label class="country-row">
                  <input
                    class="sr-only"
                    type="checkbox"
                    aria-label={t.countryCheck(name)}
                    checked={markedCountries.has(country.code)}
                    onchange={(event) => markFromRow(country.code, event.currentTarget)}
                  />
                  <img
                    class="country-flag"
                    src={flagUrl(country.code)}
                    alt=""
                    loading="lazy"
                    width="28"
                    height="21"
                    onpointerenter={showFlag}
                    onpointerleave={hideFlag}
                  />
                  <span class="country-text">
                    <span class="country-name">{name}</span>
                    <span class="capital-name">{country.capital[session.language]}</span>
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty" role="status">{searchTerm ? t.empty : t.emptyFilter}</p>
        {/if}
      </div>
    </section>

    <section class="atlas-panel map-panel" aria-labelledby="world-title">
      <div class="map-header">
        <h2 id="world-title" class="panel-title">{t.world}</h2>
        <div class="legend">
          {#if filter !== "unfound"}
            <span><i class="swatch swatch-marked" aria-hidden="true"></i>{t.mapMarked}</span>
            {#if recentCountry}
              <span><i class="swatch swatch-recent" aria-hidden="true"></i>{t.mapRecent}</span>
            {/if}
          {/if}
          {#if filter !== "found"}
            <span><i class="swatch" aria-hidden="true"></i>{t.mapUnmarked}</span>
          {/if}
        </div>
      </div>
      <WorldMap
        bind:this={map}
        bind:autoZoom={session.autoZoom}
        bind:showRecent={session.showRecent}
        marked={markedCountries}
        {filter}
        {recentCountry}
        language={session.language}
      />
    </section>
  </main>
</div>

<dialog
  class="reset-dialog"
  bind:this={resetDialog}
  aria-labelledby="reset-title"
  aria-describedby="reset-description"
  onclose={finishReset}
>
  <h2 id="reset-title">{t.resetTitle}</h2>
  <p id="reset-description">{t.resetDescription}</p>
  <form method="dialog" class="dialog-actions">
    <button type="submit" value="cancel">{t.cancel}</button>
    <button class="confirm-reset" type="submit" value="reset">{t.resetProgress}</button>
  </form>
</dialog>

{#if flagPreview}
  <img
    class="flag-preview"
    src={flagPreview.src}
    alt=""
    width="128"
    height="96"
    style:left={`${flagPreview.x}px`}
    style:top={`${flagPreview.y}px`}
  />
{/if}
