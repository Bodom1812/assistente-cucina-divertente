(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const APP_NAME = config.APP_NAME || "Chef LAIve";
  const RECIPES_TABLE = config.RECIPES_TABLE || "recipes";
  const RECIPES_STATUS = config.RECIPES_STATUS || "published";
  const SPLASH_MS = Number(config.SPLASH_MS || 3000);
  const DEFAULT_RECIPE_IMAGE = config.DEFAULT_RECIPE_IMAGE || "icons/icon-512.png";
  const RECIPES_SITE_URL = config.RECIPES_SITE_URL || "https://neil-ricettario.vercel.app/";

  const STORAGE_KEYS = {
    timers: "chef-laive-timers",
    recent: "chef-laive-recent-recipes",
    currentRecipe: "chef-laive-current-recipe",
    funIndex: "chef-laive-fun-index"
  };

  const funnyMessages = [
    "Oggi si cucina. Ordinare d'asporto resta il piano B dei deboli.",
    "Ricorda: il sale si aggiunge. Il carbone si subisce.",
    "Se qualcosa sfrigola troppo, non è sempre entusiasmo.",
    "La cucina è amore, precisione e occasionali bestemmie interiori.",
    "Tu porta pazienza, io porto i timer. Sembra già una squadra.",
    "Andrà tutto bene. O perlomeno sarà commestibile con la giusta fame.",
    "Il fornello acceso è un dettaglio importante, più di quanto sembri.",
    "Niente panico. La ricetta non corre, al massimo si brucia."
  ];

  const cookEncouragements = [
    "Stai andando bene.",
    "Questa cosa ha del potenziale serio.",
    "Continua così, chef del disagio organizzato.",
    "Molto bene. Ancora poco e sembri uno che sa cosa sta facendo.",
    "La situazione è sotto controllo. Più o meno."
  ];

  const cookSublines = [
    "Anche se la cucina a volte sembra un boss finale.",
    "L'importante è non perdere il filo. O il sugo.",
    "Respira. Nessuno ti corre dietro, tranne il timer.",
    "Eleganza, calma e mestolo saldo.",
    "La dignità culinaria è ancora intatta."
  ];

  const state = {
    recipes: [],
    filteredRecipes: [],
    timers: [],
    currentRecipe: null,
    currentStepIndex: 0,
    supabaseClient: null,
    wakeLock: null
  };

  const els = {
    splash: document.getElementById("app-splash"),
    funMessage: document.getElementById("funMessage"),

    heroTimerBtn: document.getElementById("heroTimerBtn"),
    heroRecipesBtn: document.getElementById("heroRecipesBtn"),
    heroCookBtn: document.getElementById("heroCookBtn"),
    timerPanel: document.getElementById("timerPanel"),
    recipesPanel: document.getElementById("recipesPanel"),

    timerNameInput: document.getElementById("timerNameInput"),
    timerMinutesInput: document.getElementById("timerMinutesInput"),
    startTimerBtn: document.getElementById("startTimerBtn"),
    stopAllTimersBtn: document.getElementById("stopAllTimersBtn"),
    minuteChips: document.querySelectorAll(".minute-chip[data-minutes]"),
    timersList: document.getElementById("timersList"),
    timerSummary: document.getElementById("timerSummary"),

    resumePanel: document.getElementById("resumePanel"),
    resumeCard: document.getElementById("resumeCard"),

    refreshRecipesBtn: document.getElementById("refreshRecipesBtn"),
    recipeSearchInput: document.getElementById("recipeSearchInput"),
    categorySelect: document.getElementById("categorySelect"),
    recipesGrid: document.getElementById("recipesGrid"),
    recipesState: document.getElementById("recipesState"),
    recipesCount: document.getElementById("recipesCount"),
    recentRecipes: document.getElementById("recentRecipes"),

    cookMode: document.getElementById("cookMode"),
    closeCookModeBtn: document.getElementById("closeCookModeBtn"),
    resetRecipeProgressBtn: document.getElementById("resetRecipeProgressBtn"),
    cookRecipeTitle: document.getElementById("cookRecipeTitle"),
    cookRecipeImage: document.getElementById("cookRecipeImage"),
    cookRecipeMeta: document.getElementById("cookRecipeMeta"),
    ingredientsList: document.getElementById("ingredientsList"),
    allStepsList: document.getElementById("allStepsList"),
    stepCounter: document.getElementById("stepCounter"),
    stepTimeHint: document.getElementById("stepTimeHint"),
    currentStepText: document.getElementById("currentStepText"),
    stepTimerSuggestions: document.getElementById("stepTimerSuggestions"),
    prevStepBtn: document.getElementById("prevStepBtn"),
    repeatStepBtn: document.getElementById("repeatStepBtn"),
    nextStepBtn: document.getElementById("nextStepBtn"),
    cookEncouragement: document.getElementById("cookEncouragement"),
    cookSubline: document.getElementById("cookSubline"),

    toast: document.getElementById("toast")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.classList.remove("show");
    }, 1800);
  }

  function scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = hours > 0 ? String(hours).padStart(2, "0") + ":" : "";
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return hh + mm + ":" + ss;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function getRecipeKey(recipe) {
    return String(recipe?.slug || recipe?.id || recipe?.title || "");
  }

  function resolveImageUrl(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return DEFAULT_RECIPE_IMAGE;

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    if (raw.startsWith("/")) {
      try {
        return new URL(raw, RECIPES_SITE_URL).toString();
      } catch {
        return raw;
      }
    }

    try {
      return new URL(raw, RECIPES_SITE_URL).toString();
    } catch {
      return raw;
    }
  }

  function normalizeRecipe(recipe) {
    return {
      ...recipe,
      ingredients: safeArray(recipe.ingredients),
      steps: safeArray(recipe.steps),
      image_url: resolveImageUrl(recipe.image_url || recipe.image || ""),
      _search: [
        recipe.title,
        recipe.category,
        recipe.source,
        ...(safeArray(recipe.ingredients)),
        ...(safeArray(recipe.steps))
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    };
  }

  function getRecentRecipes() {
    return loadJSON(STORAGE_KEYS.recent, []);
  }

  function saveRecentRecipe(recipeKey) {
    const current = getRecentRecipes().filter((item) => item !== recipeKey);
    current.unshift(recipeKey);
    saveJSON(STORAGE_KEYS.recent, current.slice(0, 8));
  }

  function getCurrentRecipeProgress() {
    return loadJSON(STORAGE_KEYS.currentRecipe, null);
  }

  function saveCurrentRecipeProgress(recipeKey, stepIndex) {
    saveJSON(STORAGE_KEYS.currentRecipe, { recipeKey, stepIndex });
  }

  function clearCurrentRecipeProgress() {
    localStorage.removeItem(STORAGE_KEYS.currentRecipe);
  }

  function getNextFunnyMessage() {
    const index = Number(localStorage.getItem(STORAGE_KEYS.funIndex) || "0");
    const nextIndex = (index + 1) % funnyMessages.length;
    localStorage.setItem(STORAGE_KEYS.funIndex, String(nextIndex));
    return funnyMessages[index] || funnyMessages[0];
  }

  function setFunMessage() {
    els.funMessage.textContent = getNextFunnyMessage();
  }

  function createSupabaseClient() {
    if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      return null;
    }

    return window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );
  }

  async function fetchRecipes() {
    els.recipesState.classList.remove("hidden");
    els.recipesState.textContent = "Sto andando a prendere le ricette. Spero che Supabase sia di buon umore.";
    els.recipesGrid.innerHTML = "";

    if (!state.supabaseClient) {
      els.recipesState.textContent = "Configurazione Supabase mancante.";
      return;
    }

    try {
      const { data, error } = await state.supabaseClient
        .from(RECIPES_TABLE)
        .select("*")
        .eq("status", RECIPES_STATUS)
        .order("title", { ascending: true });

      if (error) throw error;

      state.recipes = safeArray(data).map(normalizeRecipe);
      applyRecipeFilters();
      populateCategories();
      renderRecipes();
      renderRecentRecipes();
      renderResumePanel();

      if (!state.recipes.length) {
        els.recipesState.textContent = "Nessuna ricetta pubblicata trovata.";
      } else {
        els.recipesState.classList.add("hidden");
      }
    } catch (error) {
      console.error("Errore caricamento ricette:", error);
      els.recipesState.textContent = "Non sono riuscito a leggere le ricette. Ottimo inizio, ma si recupera.";
    }
  }

  function populateCategories() {
    const currentValue = els.categorySelect.value || "all";
    const categories = Array.from(
      new Set(state.recipes.map((recipe) => recipe.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "it"));

    els.categorySelect.innerHTML = '<option value="all">Tutte</option>';

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      els.categorySelect.appendChild(option);
    });

    els.categorySelect.value = categories.includes(currentValue) ? currentValue : "all";
  }

  function applyRecipeFilters() {
    const q = (els.recipeSearchInput.value || "").trim().toLowerCase();
    const category = els.categorySelect.value || "all";

    state.filteredRecipes = state.recipes.filter((recipe) => {
      const matchSearch = !q || recipe._search.includes(q);
      const matchCategory = category === "all" || recipe.category === category;
      return matchSearch && matchCategory;
    });
  }

  function recipeMetaMarkup(recipe) {
    const pieces = [
      recipe.category && `<span class="meta-pill">${escapeHtml(recipe.category)}</span>`,
      recipe.total_time && `<span class="meta-pill">Totale: ${escapeHtml(recipe.total_time)}</span>`,
      recipe.servings && `<span class="meta-pill">Porzioni: ${escapeHtml(recipe.servings)}</span>`,
      recipe.difficulty && `<span class="meta-pill">${escapeHtml(recipe.difficulty)}</span>`
    ].filter(Boolean);

    return pieces.join("");
  }

  function renderRecipes() {
    applyRecipeFilters();
    els.recipesCount.textContent = `${state.filteredRecipes.length} ricette`;

    if (!state.filteredRecipes.length) {
      els.recipesGrid.innerHTML = "";
      els.recipesState.classList.remove("hidden");
      els.recipesState.textContent = "Nessuna ricetta corrisponde ai filtri. La cucina oggi fa la preziosa.";
      return;
    }

    els.recipesState.classList.add("hidden");
    els.recipesGrid.innerHTML = state.filteredRecipes
      .map((recipe) => {
        const key = getRecipeKey(recipe);
        return `
          <article class="recipe-card">
            <div class="recipe-card__image-wrap">
              <img
                class="recipe-card__image"
                src="${escapeHtml(recipe.image_url)}"
                alt="${escapeHtml(recipe.title)}"
                loading="lazy"
                onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_RECIPE_IMAGE)}';"
              />
            </div>
            <div class="recipe-card__body">
              <div>
                <h4 class="recipe-card__title">${escapeHtml(recipe.title)}</h4>
                <div class="recipe-card__meta">${recipeMetaMarkup(recipe)}</div>
              </div>

              <div class="recipe-card__actions">
                <button class="recipe-card__action recipe-card__action--primary" type="button" data-open-recipe="${escapeHtml(key)}">
                  Cucina ora
                </button>
                <a class="recipe-card__action recipe-card__action--ghost" href="https://neil-ricettario.vercel.app/recipe/${encodeURIComponent(recipe.slug)}" target="_blank" rel="noopener">
                  Apri ricetta
                </a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    els.recipesGrid.querySelectorAll("[data-open-recipe]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-open-recipe");
        const recipe = state.recipes.find((item) => getRecipeKey(item) === key);
        if (recipe) {
          openCookMode(recipe, 0);
        }
      });
    });
  }

  function renderRecentRecipes() {
    const recentKeys = getRecentRecipes();
    const recentRecipes = recentKeys
      .map((key) => state.recipes.find((recipe) => getRecipeKey(recipe) === key))
      .filter(Boolean)
      .slice(0, 4);

    if (!recentRecipes.length) {
      els.recentRecipes.innerHTML =
        '<div class="empty-state empty-state--small">Non hai ancora aperto nessuna ricetta.</div>';
      return;
    }

    els.recentRecipes.innerHTML = recentRecipes
      .map((recipe) => {
        const key = getRecipeKey(recipe);
        return `
          <article class="recent-card">
            <h4>${escapeHtml(recipe.title)}</h4>
            <p>${escapeHtml(recipe.category || "Ricetta")} · ${escapeHtml(recipe.total_time || "Tempo libero interpretativo")}</p>
            <button class="primary-btn" type="button" data-recent-open="${escapeHtml(key)}">Riprendi da qui</button>
          </article>
        `;
      })
      .join("");

    els.recentRecipes.querySelectorAll("[data-recent-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-recent-open");
        const recipe = state.recipes.find((item) => getRecipeKey(item) === key);
        if (recipe) {
          openCookMode(recipe, 0);
        }
      });
    });
  }

  function renderResumePanel() {
    const progress = getCurrentRecipeProgress();

    if (!progress || !progress.recipeKey) {
      els.resumePanel.classList.add("hidden");
      els.resumeCard.innerHTML = "";
      return;
    }

    const recipe = state.recipes.find((item) => getRecipeKey(item) === progress.recipeKey);
    if (!recipe) {
      els.resumePanel.classList.add("hidden");
      return;
    }

    const stepNumber = Math.min((progress.stepIndex || 0) + 1, Math.max(recipe.steps.length, 1));

    els.resumePanel.classList.remove("hidden");
    els.resumeCard.innerHTML = `
      <h4>${escapeHtml(recipe.title)}</h4>
      <p>Sei rimasto al passaggio ${stepNumber} di ${recipe.steps.length || 1}.</p>
      <button id="resumeRecipeBtn" class="resume-btn" type="button">Riprendi ricetta</button>
    `;

    const resumeBtn = document.getElementById("resumeRecipeBtn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        openCookMode(recipe, progress.stepIndex || 0);
      });
    }
  }

  function parseMinutesFromText(text) {
    const source = String(text || "").toLowerCase();
    const found = new Set();

    const patterns = [
      /(\d+)\s*(?:min|mins|minute|minuti)\b/g,
      /(\d+)\s*(?:ora|ore|h)\b/g
    ];

    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const value = Number(match[1]);
        if (!Number.isFinite(value) || value <= 0) continue;
        if (index === 1) {
          found.add(value * 60);
        } else {
          found.add(value);
        }
      }
    });

    return Array.from(found).sort((a, b) => a - b);
  }

  function renderCookMeta(recipe) {
    const meta = [
      recipe.prep_time && ["Preparazione", recipe.prep_time],
      recipe.cook_time && ["Cottura", recipe.cook_time],
      recipe.rest_time && ["Riposo", recipe.rest_time],
      recipe.total_time && ["Totale", recipe.total_time],
      recipe.servings && ["Porzioni", recipe.servings],
      recipe.difficulty && ["Difficoltà", recipe.difficulty]
    ].filter(Boolean);

    els.cookRecipeMeta.innerHTML = meta
      .map(
        ([label, value]) => `
          <div class="meta-box">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
          </div>
        `
      )
      .join("");
  }

  function updateCookStep() {
    if (!state.currentRecipe) return;

    const recipe = state.currentRecipe;
    const totalSteps = Math.max(recipe.steps.length, 1);
    const currentIndex = Math.min(Math.max(state.currentStepIndex, 0), totalSteps - 1);
    const stepText = recipe.steps[currentIndex] || "Nessun passaggio disponibile.";
    const minutes = parseMinutesFromText(stepText);

    state.currentStepIndex = currentIndex;
    saveCurrentRecipeProgress(getRecipeKey(recipe), currentIndex);

    els.stepCounter.textContent = `Passaggio ${currentIndex + 1} di ${totalSteps}`;
    els.currentStepText.textContent = stepText;
    els.prevStepBtn.disabled = currentIndex === 0;
    els.nextStepBtn.disabled = currentIndex >= totalSteps - 1;

    if (minutes.length) {
      const pretty = minutes.map((item) => `${item} min`).join(" · ");
      els.stepTimeHint.classList.remove("hidden");
      els.stepTimeHint.textContent = `Tempo rilevato: ${pretty}`;
    } else {
      els.stepTimeHint.classList.add("hidden");
      els.stepTimeHint.textContent = "";
    }

    els.stepTimerSuggestions.innerHTML = minutes.length
      ? minutes
          .map(
            (minute) =>
              `<button class="step-suggestion-btn" type="button" data-step-minutes="${minute}">
                Avvia ${minute} min
              </button>`
          )
          .join("")
      : "";

    els.stepTimerSuggestions.querySelectorAll("[data-step-minutes]").forEach((button) => {
      button.addEventListener("click", () => {
        const minute = Number(button.getAttribute("data-step-minutes"));
        createTimer({
          name: `${recipe.title} · step ${currentIndex + 1}`,
          minutes: minute
        });
      });
    });

    const encouragementIndex = currentIndex % cookEncouragements.length;
    els.cookEncouragement.textContent = cookEncouragements[encouragementIndex];
    els.cookSubline.textContent = cookSublines[encouragementIndex % cookSublines.length];
  }

  async function requestWakeLock() {
    try {
      if (!("wakeLock" in navigator) || state.wakeLock) return;
      state.wakeLock = await navigator.wakeLock.request("screen");
      state.wakeLock.addEventListener("release", () => {
        state.wakeLock = null;
      });
    } catch (error) {
      console.warn("Wake lock non disponibile:", error);
    }
  }

  async function releaseWakeLock() {
    try {
      if (state.wakeLock) {
        await state.wakeLock.release();
        state.wakeLock = null;
      }
    } catch (error) {
      console.warn("Errore rilascio wake lock:", error);
    }
  }

  function openCookMode(recipe, stepIndex) {
    state.currentRecipe = recipe;
    state.currentStepIndex = Number.isFinite(stepIndex) ? stepIndex : 0;

    saveRecentRecipe(getRecipeKey(recipe));
    saveCurrentRecipeProgress(getRecipeKey(recipe), state.currentStepIndex);
    renderRecentRecipes();
    renderResumePanel();

    els.cookRecipeTitle.textContent = recipe.title || "Ricetta";
    els.cookRecipeImage.src = recipe.image_url || DEFAULT_RECIPE_IMAGE;
    els.cookRecipeImage.alt = recipe.title || "Immagine ricetta";

    renderCookMeta(recipe);

    els.ingredientsList.innerHTML = recipe.ingredients.length
      ? recipe.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>Nessun ingrediente disponibile.</li>";

    els.allStepsList.innerHTML = recipe.steps.length
      ? recipe.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>Nessun passaggio disponibile.</li>";

    updateCookStep();

    els.cookMode.classList.remove("hidden");
    els.cookMode.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    requestWakeLock();
  }

  function closeCookMode() {
    els.cookMode.classList.add("hidden");
    els.cookMode.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    releaseWakeLock();
  }

  function openSavedCookModeIfPossible() {
    const progress = getCurrentRecipeProgress();

    if (!progress || !progress.recipeKey) {
      showToast("Apri una ricetta e poi qui potrai rientrare al volo in modalità cucina.");
      scrollToElement(els.recipesPanel);
      return;
    }

    const recipe = state.recipes.find((item) => getRecipeKey(item) === progress.recipeKey);

    if (!recipe) {
      showToast("Non trovo più l'ultima ricetta aperta. Scendiamo alle ricette e ne scegliamo un'altra.");
      scrollToElement(els.recipesPanel);
      return;
    }

    openCookMode(recipe, progress.stepIndex || 0);
  }

  function beepAlarm() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      [0, 0.28, 0.56].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(880, now + offset);

        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      });
    } catch (error) {
      console.warn("Beep timer non riuscito:", error);
    }
  }

  function vibrateAlarm() {
    if ("vibrate" in navigator) {
      navigator.vibrate([220, 120, 220, 120, 260]);
    }
  }

  async function notifyTimer(timer) {
    try {
      if (!("Notification" in window)) return;

      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if (Notification.permission === "granted") {
        new Notification(`${APP_NAME} · Timer finito`, {
          body: `${timer.name} è arrivato a zero.`,
          icon: "icons/icon-192.png",
          badge: "icons/icon-192.png"
        });
      }
    } catch (error) {
      console.warn("Notifica timer non disponibile:", error);
    }
  }

  function saveTimers() {
    saveJSON(STORAGE_KEYS.timers, state.timers);
  }

  function loadTimers() {
    const persisted = loadJSON(STORAGE_KEYS.timers, []);
    const now = Date.now();

    state.timers = persisted
      .filter((timer) => timer && timer.id)
      .map((timer) => {
        if (timer.status === "running" && timer.endsAt && timer.endsAt < now) {
          return {
            ...timer,
            remainingMs: 0,
            status: "done"
          };
        }

        return timer;
      });

    saveTimers();
  }

  function createTimer({ name, minutes }) {
    const cleanMinutes = Number(minutes);
    if (!Number.isFinite(cleanMinutes) || cleanMinutes <= 0) {
      showToast("Metti un numero di minuti sensato, possibilmente maggiore di zero.");
      return;
    }

    const timerName = String(name || "").trim() || "Timer senza nome ma con carattere";
    const durationMs = cleanMinutes * 60 * 1000;
    const now = Date.now();

    const timer = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(now) + Math.random().toString(16).slice(2),
      name: timerName,
      durationMs,
      endsAt: now + durationMs,
      status: "running",
      createdAt: now
    };

    state.timers.unshift(timer);
    saveTimers();
    renderTimers();

    els.timerNameInput.value = "";
    els.timerMinutesInput.value = "";
    showToast(`Timer "${timerName}" avviato. Adesso tocca a te non sabotarti.`);
  }

  function pauseTimer(timerId) {
    const now = Date.now();
    state.timers = state.timers.map((timer) => {
      if (timer.id !== timerId || timer.status !== "running") return timer;
      return {
        ...timer,
        status: "paused",
        remainingMs: Math.max(0, timer.endsAt - now)
      };
    });
    saveTimers();
    renderTimers();
  }

  function resumeTimer(timerId) {
    const now = Date.now();
    state.timers = state.timers.map((timer) => {
      if (timer.id !== timerId || timer.status !== "paused") return timer;
      const remainingMs = Number(timer.remainingMs || timer.durationMs || 0);
      return {
        ...timer,
        status: "running",
        endsAt: now + remainingMs
      };
    });
    saveTimers();
    renderTimers();
  }

  function deleteTimer(timerId) {
    state.timers = state.timers.filter((timer) => timer.id !== timerId);
    saveTimers();
    renderTimers();
  }

  function stopAllTimers() {
    state.timers = [];
    saveTimers();
    renderTimers();
    showToast("Tutti i timer sono stati fermati. Scelta drastica ma coerente.");
  }

  function markTimerDone(timerId) {
    const timer = state.timers.find((item) => item.id === timerId);
    if (!timer || timer.status === "done") return;

    state.timers = state.timers.map((item) =>
      item.id === timerId
        ? { ...item, status: "done", remainingMs: 0 }
        : item
    );
    saveTimers();
    renderTimers();

    beepAlarm();
    vibrateAlarm();
    notifyTimer(timer);
    showToast(`Timer finito: ${timer.name}`);
  }

  function getTimerSnapshot(timer) {
    if (timer.status === "running") {
      const remainingMs = Math.max(0, timer.endsAt - Date.now());
      const progress = Math.min(100, Math.max(0, ((timer.durationMs - remainingMs) / timer.durationMs) * 100));
      return { remainingMs, progress };
    }

    if (timer.status === "paused") {
      const remainingMs = Math.max(0, Number(timer.remainingMs || 0));
      const progress = Math.min(100, Math.max(0, ((timer.durationMs - remainingMs) / timer.durationMs) * 100));
      return { remainingMs, progress };
    }

    return { remainingMs: 0, progress: 100 };
  }

  function renderTimers() {
    if (!state.timers.length) {
      els.timerSummary.textContent = "Nessun timer attivo. Pace apparente.";
      els.timersList.innerHTML =
        '<div class="empty-state empty-state--small">Qui compariranno i tuoi timer. E le tue responsabilità temporali.</div>';
      return;
    }

    const runningCount = state.timers.filter((timer) => timer.status === "running").length;
    const pausedCount = state.timers.filter((timer) => timer.status === "paused").length;
    const doneCount = state.timers.filter((timer) => timer.status === "done").length;

    const bits = [];
    if (runningCount) bits.push(`${runningCount} in corso`);
    if (pausedCount) bits.push(`${pausedCount} in pausa`);
    if (doneCount) bits.push(`${doneCount} finiti`);

    els.timerSummary.textContent = bits.join(" · ");

    els.timersList.innerHTML = state.timers
      .map((timer) => {
        const snapshot = getTimerSnapshot(timer);
        const statusText =
          timer.status === "running"
            ? "In corso"
            : timer.status === "paused"
              ? "In pausa"
              : "Finito";
        const startMins = Math.round(timer.durationMs / 60000);

        return `
          <article class="timer-card ${timer.status === "done" ? "timer-card--done" : ""}">
            <div class="timer-card__top">
              <div>
                <h4 class="timer-card__title">${escapeHtml(timer.name)}</h4>
                <p class="timer-card__sub">${statusText} · Durata iniziale: ${startMins} min</p>
              </div>
              <div class="timer-time">${formatDuration(snapshot.remainingMs)}</div>
            </div>

            <div class="timer-progress">
              <div class="timer-progress__bar" style="width:${snapshot.progress}%"></div>
            </div>

            <div class="timer-actions">
              ${
                timer.status === "running"
                  ? `<button class="timer-action-btn" type="button" data-pause-timer="${timer.id}">Pausa</button>`
                  : ""
              }
              ${
                timer.status === "paused"
                  ? `<button class="timer-action-btn" type="button" data-resume-timer="${timer.id}">Riprendi</button>`
                  : ""
              }
              <button class="timer-action-btn timer-action-btn--danger" type="button" data-delete-timer="${timer.id}">
                Elimina
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    els.timersList.querySelectorAll("[data-pause-timer]").forEach((button) => {
      button.addEventListener("click", () => pauseTimer(button.getAttribute("data-pause-timer")));
    });

    els.timersList.querySelectorAll("[data-resume-timer]").forEach((button) => {
      button.addEventListener("click", () => resumeTimer(button.getAttribute("data-resume-timer")));
    });

    els.timersList.querySelectorAll("[data-delete-timer]").forEach((button) => {
      button.addEventListener("click", () => deleteTimer(button.getAttribute("data-delete-timer")));
    });
  }

  function tickTimers() {
    let changed = false;

    state.timers.forEach((timer) => {
      if (timer.status === "running" && timer.endsAt <= Date.now()) {
        markTimerDone(timer.id);
        changed = true;
      }
    });

    if (!changed) {
      renderTimers();
    }
  }

  function bindEvents() {
    els.startTimerBtn.addEventListener("click", () => {
      createTimer({
        name: els.timerNameInput.value,
        minutes: els.timerMinutesInput.value
      });
    });

    els.timerMinutesInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        createTimer({
          name: els.timerNameInput.value,
          minutes: els.timerMinutesInput.value
        });
      }
    });

    els.timerNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        createTimer({
          name: els.timerNameInput.value,
          minutes: els.timerMinutesInput.value
        });
      }
    });

    els.minuteChips.forEach((button) => {
      button.addEventListener("click", () => {
        const amount = Number(button.getAttribute("data-minutes"));
        const current = Number(els.timerMinutesInput.value || "0");
        els.timerMinutesInput.value = String(Math.max(0, current + amount));
      });
    });

    els.stopAllTimersBtn.addEventListener("click", stopAllTimers);

    els.refreshRecipesBtn.addEventListener("click", () => {
      fetchRecipes();
      showToast("Aggiorno le ricette. Nessun dramma, solo dati.");
    });

    els.recipeSearchInput.addEventListener("input", renderRecipes);
    els.categorySelect.addEventListener("change", renderRecipes);

    els.heroTimerBtn.addEventListener("click", () => {
      scrollToElement(els.timerPanel);
      els.timerMinutesInput.focus();
    });

    els.heroRecipesBtn.addEventListener("click", () => {
      scrollToElement(els.recipesPanel);
      els.recipeSearchInput.focus();
    });

    els.heroCookBtn.addEventListener("click", () => {
      openSavedCookModeIfPossible();
    });

    els.closeCookModeBtn.addEventListener("click", closeCookMode);

    els.prevStepBtn.addEventListener("click", () => {
      if (!state.currentRecipe) return;
      state.currentStepIndex = Math.max(0, state.currentStepIndex - 1);
      updateCookStep();
    });

    els.nextStepBtn.addEventListener("click", () => {
      if (!state.currentRecipe) return;
      state.currentStepIndex = Math.min(
        Math.max(state.currentRecipe.steps.length - 1, 0),
        state.currentStepIndex + 1
      );
      updateCookStep();
    });

    els.repeatStepBtn.addEventListener("click", () => {
      updateCookStep();
      showToast("Step ripetuto. Non era colpa mia se stavi pensando ad altro.");
    });

    els.resetRecipeProgressBtn.addEventListener("click", () => {
      if (!state.currentRecipe) return;
      state.currentStepIndex = 0;
      saveCurrentRecipeProgress(getRecipeKey(state.currentRecipe), 0);
      updateCookStep();
      showToast("Progressione ricetta azzerata.");
    });

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible" && !els.cookMode.classList.contains("hidden")) {
        await requestWakeLock();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.cookMode.classList.contains("hidden")) {
        closeCookMode();
      }
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((error) => {
        console.warn("Service worker non registrato:", error);
      });
    }
  }

  function hideSplash() {
    setTimeout(() => {
      els.splash.classList.add("app-splash--hide");
    }, SPLASH_MS);
  }

  function initDocumentMeta() {
    document.title = APP_NAME;
  }

  function init() {
    initDocumentMeta();
    state.supabaseClient = createSupabaseClient();
    setFunMessage();
    loadTimers();
    renderTimers();
    bindEvents();
    fetchRecipes();
    hideSplash();
    registerServiceWorker();

    setInterval(tickTimers, 1000);
  }

  init();
})();