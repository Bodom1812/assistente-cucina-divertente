(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const APP_NAME = config.APP_NAME || "Chef LAIve";
  const RECIPES_TABLE = config.RECIPES_TABLE || "recipes";
  const RECIPES_STATUS = config.RECIPES_STATUS || "published";
  const SPLASH_MS = Number(config.SPLASH_MS || 3000);
  const DEFAULT_RECIPE_IMAGE = config.DEFAULT_RECIPE_IMAGE || "icons/icon-512.png";
  const RECIPES_SITE_URL = config.RECIPES_SITE_URL || "https://neil-ricettario.vercel.app/";

  const SHOPPING_LISTS_TABLE = "shopping_lists";
  const SHOPPING_ITEMS_TABLE = "shopping_items";
  const SHOPPING_STORAGE_KEY = "laista-active-list-id";
  const SHOPPING_APP_URL = "https://laista-della-spesa.vercel.app/";

  // Stesso Supabase usato dalla LAIsta
  const SHOPPING_SUPABASE_URL = "https://idxyoplprfuazkatzdxg.supabase.co";
  const SHOPPING_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkeHlvcGxwcmZ1YXprYXR6ZHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjYwOTcsImV4cCI6MjA4OTQwMjA5N30.mngK-vE4vsgd_T88OSAY3e0Hk_CrdIgyWJmdlRjBAMs";

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
    supabaseClient: null,         // ricette
    shoppingSupabaseClient: null, // spesa
    wakeLock: null,
    recognition: null,
    voiceListening: false,
    shoppingLists: [],
    shoppingItems: [],
    selectedShoppingListId: ""
  };

  const els = {
    splash: document.getElementById("app-splash"),
    funMessage: document.getElementById("funMessage"),

    heroTimerBtn: document.getElementById("heroTimerBtn"),
    heroRecipesBtn: document.getElementById("heroRecipesBtn"),
    heroCookBtn: document.getElementById("heroCookBtn"),
    heroShoppingBtn: document.getElementById("heroShoppingBtn"),

    timerPanel: document.getElementById("timerPanel"),
    recipesPanel: document.getElementById("recipesPanel"),
    shoppingPanel: document.getElementById("shoppingPanel"),

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

    shoppingListSelect: document.getElementById("shoppingListSelect"),
    shoppingState: document.getElementById("shoppingState"),
    shoppingPreview: document.getElementById("shoppingPreview"),
    shoppingOpenBtn: document.getElementById("shoppingOpenBtn"),
    shoppingRefreshBtn: document.getElementById("shoppingRefreshBtn"),
    shoppingCount: document.getElementById("shoppingCount"),

    cookMode: document.getElementById("cookMode"),
    closeCookModeBtn: document.getElementById("closeCookModeBtn"),
    resetRecipeProgressBtn: document.getElementById("resetRecipeProgressBtn"),
    cookRecipeTitle: document.getElementById("cookRecipeTitle"),
    cookRecipeImage: document.getElementById("cookRecipeImage"),
    cookRecipeMeta: document.getElementById("cookRecipeMeta"),
    ingredientsList: document.getElementById("ingredientsList"),
    allStepsList: document.getElementById("allStepsList"),
    stepCard: document.getElementById("stepCard"),
    stepCounter: document.getElementById("stepCounter"),
    stepTimeHint: document.getElementById("stepTimeHint"),
    currentStepText: document.getElementById("currentStepText"),
    stepTimerSuggestions: document.getElementById("stepTimerSuggestions"),
    prevStepBtn: document.getElementById("prevStepBtn"),
    repeatStepBtn: document.getElementById("repeatStepBtn"),
    nextStepBtn: document.getElementById("nextStepBtn"),
    speakStepBtn: document.getElementById("speakStepBtn"),
    stopSpeechBtn: document.getElementById("stopSpeechBtn"),
    voiceToggleBtn: document.getElementById("voiceToggleBtn"),
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

  function scrollCookStepToTop() {
    if (!els.stepCard) return;
    els.stepCard.scrollIntoView({
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

  function parseStringList(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value !== "string") {
      return [];
    }

    const source = value.trim();
    if (!source) return [];

    if (source.startsWith("[") && source.endsWith("]")) {
      try {
        const parsed = JSON.parse(source);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fallback sotto
      }
    }

    return source
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .map((item) => item.replace(/^[•\-–—*\d.)]+\s*/, "").trim())
      .filter(Boolean);
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
    const ingredients = parseStringList(recipe.ingredients);
    const steps = parseStringList(recipe.steps);

    return {
      ...recipe,
      ingredients,
      steps,
      image_url: resolveImageUrl(recipe.image_url || recipe.image || ""),
      _search: [
        recipe.title,
        recipe.category,
        recipe.source,
        ...ingredients,
        ...steps
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
    if (els.funMessage) {
      els.funMessage.textContent = getNextFunnyMessage();
    }
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

  function createShoppingSupabaseClient() {
    if (!window.supabase) return null;

    return window.supabase.createClient(
      SHOPPING_SUPABASE_URL,
      SHOPPING_SUPABASE_ANON_KEY
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
      const query = state.supabaseClient
        .from(RECIPES_TABLE)
        .select("*")
        .order("title", { ascending: true });

      const { data, error } = RECIPES_STATUS
        ? await query.eq("status", RECIPES_STATUS)
        : await query;

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
        const recipeHref = recipe.slug
          ? `https://neil-ricettario.vercel.app/recipe/${encodeURIComponent(recipe.slug)}`
          : RECIPES_SITE_URL;

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
                <button class="recipe-card__action recipe-card__action--ghost" type="button" data-add-shopping="${escapeHtml(key)}">
                  Aggiungi alla spesa
                </button>
                <a class="recipe-card__action recipe-card__action--ghost" href="${escapeHtml(recipeHref)}" target="_blank" rel="noopener">
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

    els.recipesGrid.querySelectorAll("[data-add-shopping]").forEach((button) => {
      button.addEventListener("click", async () => {
        const key = button.getAttribute("data-add-shopping");
        const recipe = state.recipes.find((item) => getRecipeKey(item) === key);
        if (recipe) {
          await addRecipeIngredientsToShoppingList(recipe);
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
      els.resumeCard.innerHTML = "";
      return;
    }

    const totalSteps = Math.max(recipe.steps.length, 1);
    const stepNumber = Math.min((progress.stepIndex || 0) + 1, totalSteps);

    els.resumePanel.classList.remove("hidden");
    els.resumeCard.innerHTML = `
      <h4>${escapeHtml(recipe.title)}</h4>
      <p>Sei rimasto al passaggio ${stepNumber} di ${totalSteps}.</p>
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

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      showToast("La lettura vocale non è disponibile qui.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(String(text || ""));
    utterance.lang = "it-IT";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function setVoiceToggleUi(isListening) {
    if (!els.voiceToggleBtn) return;

    if (isListening) {
      els.voiceToggleBtn.classList.add("voice-active");
      els.voiceToggleBtn.textContent = "🎤 In ascolto...";
    } else {
      els.voiceToggleBtn.classList.remove("voice-active");
      els.voiceToggleBtn.textContent = "🎤 Attiva voce";
    }
  }

  function handleVoiceCommand(text) {
    const cmd = String(text || "").toLowerCase().trim();
    if (!cmd) return;

    console.log("[Chef LAIve][voce] comando riconosciuto:", cmd);

    if (
      cmd === "leggi" ||
      cmd.includes("leggi step") ||
      cmd.includes("leggi questo") ||
      cmd.includes("leggilo")
    ) {
      speak(els.currentStepText.textContent);
      showToast("Leggo lo step.");
      return;
    }

    if (cmd.includes("avanti")) {
      els.nextStepBtn.click();
      showToast("Step successivo.");
      return;
    }

    if (cmd.includes("indietro")) {
      els.prevStepBtn.click();
      showToast("Step precedente.");
      return;
    }

    if (cmd.includes("ripeti")) {
      els.repeatStepBtn.click();
      return;
    }

    if (cmd.includes("chiudi")) {
      closeCookMode();
      return;
    }

    if (cmd.includes("stop voce") || cmd === "stop") {
      stopSpeech();
      showToast("Voce fermata.");
      return;
    }

    const timerMatch =
      cmd.match(/(?:avvia\s+)?timer\s*(\d+)\s*(?:minuti|minuto|min|minute)?/) ||
      cmd.match(/(\d+)\s*(?:minuti|minuto|min|minute)\s*(?:di\s+)?timer/);

    if (timerMatch) {
      const minutes = Number(timerMatch[1]);

      if (Number.isFinite(minutes) && minutes > 0) {
        const timerName = state.currentRecipe
          ? `${state.currentRecipe.title} · timer vocale`
          : "Timer vocale";

        createTimer({
          name: timerName,
          minutes
        });

        showToast(`Timer vocale avviato: ${minutes} min`);
        speak(`Timer avviato per ${minutes} minuti`);
        return;
      }
    }

    showToast(`Comando non riconosciuto: ${cmd}`);
  }

  function toggleVoiceRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      showToast("Comandi vocali non supportati su questo browser.");
      return;
    }

    if (!state.recognition) {
      state.recognition = new SpeechRecognitionClass();
      state.recognition.lang = "it-IT";
      state.recognition.continuous = true;
      state.recognition.interimResults = false;

      state.recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript || "";
        handleVoiceCommand(transcript);
      };

      state.recognition.onend = () => {
        if (state.voiceListening) {
          try {
            state.recognition.start();
          } catch {
            state.voiceListening = false;
            setVoiceToggleUi(false);
          }
        } else {
          setVoiceToggleUi(false);
        }
      };

      state.recognition.onerror = () => {
        state.voiceListening = false;
        setVoiceToggleUi(false);
        showToast("Microfono non disponibile o permesso negato.");
      };
    }

    if (!state.voiceListening) {
      try {
        state.recognition.start();
        state.voiceListening = true;
        setVoiceToggleUi(true);
        showToast("Comandi vocali attivi.");
      } catch {
        state.voiceListening = false;
        setVoiceToggleUi(false);
        showToast("Non sono riuscito ad avviare il microfono.");
      }
    } else {
      state.voiceListening = false;
      setVoiceToggleUi(false);
      try {
        state.recognition.stop();
      } catch {
        // ignore
      }
      showToast("Comandi vocali disattivati.");
    }
  }

  function completeCurrentRecipe() {
    if (!state.currentRecipe) return;

    clearCurrentRecipeProgress();
    renderResumePanel();
    showToast(`Ricetta completata: ${state.currentRecipe.title}`);
    closeCookMode();
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

    if (currentIndex >= totalSteps - 1) {
      els.nextStepBtn.disabled = false;
      els.nextStepBtn.textContent = "✅ Completa";
    } else {
      els.nextStepBtn.disabled = false;
      els.nextStepBtn.textContent = "➡ Avanti";
    }

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

    if (currentIndex === totalSteps - 1) {
      els.cookSubline.textContent = "Ultimo step. Chiudi in bellezza e poi completa la ricetta.";
    }

    scrollCookStepToTop();
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
    stopSpeech();

    if (state.voiceListening && state.recognition) {
      state.voiceListening = false;
      setVoiceToggleUi(false);
      try {
        state.recognition.stop();
      } catch {
        // ignore
      }
    }
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

  function getStoredShoppingListId() {
    return localStorage.getItem(SHOPPING_STORAGE_KEY) || "";
  }

  function saveStoredShoppingListId(listId) {
    if (!listId) return;
    localStorage.setItem(SHOPPING_STORAGE_KEY, listId);
  }

  function normalizeIngredientName(raw) {
    let text = String(raw || "").toLowerCase().trim();

    text = text.replace(/\([^)]*\)/g, " ");
    text = text.replace(/\[[^\]]*\]/g, " ");
    text = text.replace(/,+/g, " ");
    text = text.replace(/\s+/g, " ");

    text = text.replace(
      /^(?:circa|ca\.?|qb|q\.b\.?|quanto basta|un pizzico di|una presa di)\s+/i,
      ""
    );

    text = text.replace(
      /^(\d+[.,]?\d*)\s*(kg|g|gr|grammi|grammo|ml|cl|dl|l|litri|litro|cucchiai|cucchiaio|cucchiaini|cucchiaino|tazze|tazza|bicchieri|bicchiere|spicchi|spicchio|fette|fetta|rametti|rametto|foglie|foglia|pezzi|pezzo)?\s*(di\s+)?/i,
      ""
    );

    text = text.replace(
      /^(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+/i,
      ""
    );

    text = text.replace(/^(di|da|del|della|dello|dei|degli|delle)\s+/i, "");
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }

  function shouldIgnoreIngredient(raw) {
    const text = String(raw || "").toLowerCase().trim();
    const normalized = normalizeIngredientName(text);

    if (!normalized) return true;

    const exactIgnored = new Set([
      "q.b.",
      "qb",
      "quanto basta",
      "sale q.b.",
      "pepe q.b.",
      "acqua q.b.",
      "olio q.b.",
      "olio evo q.b.",
      "farina per spolverare",
      "burro per ungere"
    ]);

    if (exactIgnored.has(text) || exactIgnored.has(normalized)) {
      return true;
    }

    if (
      text.includes("q.b") ||
      text.includes("q.b.") ||
      text.includes("quanto basta")
    ) {
      return true;
    }

    return false;
  }

  function getDisplayIngredientName(raw) {
    const text = String(raw || "").trim();
    const normalized = normalizeIngredientName(text);
    if (!normalized) return "";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  async function fetchShoppingLists() {
    if (!els.shoppingListSelect || !els.shoppingState || !els.shoppingPreview) return;

    els.shoppingState.classList.remove("hidden");
    els.shoppingState.textContent = "Sto caricando le liste della spesa.";
    els.shoppingPreview.innerHTML = "";

    if (!state.shoppingSupabaseClient) {
      els.shoppingState.textContent = "Configurazione Supabase spesa mancante.";
      if (els.shoppingCount) els.shoppingCount.textContent = "0 articoli";
      return;
    }

    try {
      const { data, error } = await state.shoppingSupabaseClient
        .from(SHOPPING_LISTS_TABLE)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      state.shoppingLists = safeArray(data);

      if (!state.shoppingLists.length) {
        els.shoppingListSelect.innerHTML = "";
        els.shoppingState.textContent = "Nessuna lista disponibile.";
        if (els.shoppingCount) els.shoppingCount.textContent = "0 articoli";
        return;
      }

      const storedId = getStoredShoppingListId();
      const validStored = state.shoppingLists.find((item) => String(item.id) === String(storedId));

      state.selectedShoppingListId = validStored
        ? String(validStored.id)
        : String(state.shoppingLists[0].id);

      saveStoredShoppingListId(state.selectedShoppingListId);
      renderShoppingLists();
      await fetchShoppingItems(state.selectedShoppingListId);
    } catch (error) {
      console.error("Errore caricamento liste spesa:", error);
      els.shoppingState.textContent = "Non sono riuscito a caricare le liste della spesa.";
      if (els.shoppingCount) els.shoppingCount.textContent = "0 articoli";
    }
  }

  function renderShoppingLists() {
    if (!els.shoppingListSelect) return;

    els.shoppingListSelect.innerHTML = state.shoppingLists
      .map(
        (list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.name || "Lista")}</option>`
      )
      .join("");

    if (state.selectedShoppingListId) {
      els.shoppingListSelect.value = state.selectedShoppingListId;
    }
  }

  async function fetchShoppingItems(listId) {
    if (!els.shoppingState || !els.shoppingPreview) return;

    if (!listId) {
      state.shoppingItems = [];
      els.shoppingState.classList.remove("hidden");
      els.shoppingState.textContent = "Seleziona una lista della spesa.";
      els.shoppingPreview.innerHTML = "";
      if (els.shoppingCount) els.shoppingCount.textContent = "0 articoli";
      return;
    }

    els.shoppingState.classList.remove("hidden");
    els.shoppingState.textContent = "Sto caricando gli articoli della lista.";
    els.shoppingPreview.innerHTML = "";

    if (!state.shoppingSupabaseClient) {
      els.shoppingState.textContent = "Configurazione Supabase spesa mancante.";
      if (els.shoppingCount) els.shoppingCount.textContent = "0 articoli";
      return;
    }

    try {
      const { data, error } = await state.shoppingSupabaseClient
        .from(SHOPPING_ITEMS_TABLE)
        .select("*")
        .eq("list_id", listId)
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      state.shoppingItems = safeArray(data);
      renderShoppingPreview();
    } catch (error) {
      console.error("Errore caricamento articoli spesa:", error);
      els.shoppingState.classList.remove("hidden");
      els.shoppingState.textContent = "Non sono riuscito a caricare gli articoli della lista.";
      els.shoppingPreview.innerHTML = "";
      if (els.shoppingCount) els.shoppingCount.textContent = "0 articoli";
    }
  }

  function renderShoppingPreview() {
    if (!els.shoppingState || !els.shoppingPreview) return;

    if (els.shoppingCount) {
      els.shoppingCount.textContent = `${state.shoppingItems.length} articoli`;
    }

    if (!state.shoppingItems.length) {
      els.shoppingState.classList.remove("hidden");
      els.shoppingState.textContent = "La lista è vuota. Un raro momento di quiete.";
      els.shoppingPreview.innerHTML = "";
      return;
    }

    els.shoppingState.classList.add("hidden");

    const visibleItems = state.shoppingItems.slice(0, 12);

    els.shoppingPreview.innerHTML = `
      <div class="recent-list">
        ${visibleItems
          .map((item) => {
            const status = item.completed ? "✓" : "•";
            const quantity = item.quantity ? ` · ${escapeHtml(item.quantity)}` : "";
            const priority = item.priority ? " · Priorità" : "";

            return `
              <article class="recent-card">
                <h4>${status} ${escapeHtml(item.name || "Articolo")}</h4>
                <p>${escapeHtml(item.completed ? "Completato" : "Da comprare")}${quantity}${priority}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function openFullShoppingApp() {
    const listId = state.selectedShoppingListId;
    const url = listId
      ? `${SHOPPING_APP_URL}?list=${encodeURIComponent(listId)}`
      : SHOPPING_APP_URL;

    window.open(url, "_blank", "noopener");
  }

  async function addRecipeIngredientsToShoppingList(recipe) {
    const listId = state.selectedShoppingListId;

    if (!listId) {
      showToast("Seleziona prima una lista della spesa.");
      scrollToElement(els.shoppingPanel);
      return;
    }

    if (!state.shoppingSupabaseClient) {
      showToast("Configurazione Supabase spesa mancante.");
      return;
    }

    let rawIngredients = recipe?.ingredients || [];

    if (typeof rawIngredients === "string") {
      rawIngredients = parseStringList(rawIngredients);
    }

    rawIngredients = safeArray(rawIngredients);

    console.log("INGREDIENTI ORIGINALI:", recipe?.ingredients);
    console.log("INGREDIENTI PARSATI:", rawIngredients);

    if (!rawIngredients.length) {
      showToast("Questa ricetta non ha ingredienti utilizzabili.");
      return;
    }

    const existingNormalized = new Set(
      state.shoppingItems
        .map((item) => normalizeIngredientName(item?.name || ""))
        .filter(Boolean)
    );

    const toInsert = [];
    let ignoredCount = 0;
    let duplicateCount = 0;

    rawIngredients.forEach((raw) => {
      if (shouldIgnoreIngredient(raw)) {
        ignoredCount += 1;
        return;
      }

      const normalized = normalizeIngredientName(raw);
      const displayName = getDisplayIngredientName(raw);

      if (!normalized || !displayName) {
        ignoredCount += 1;
        return;
      }

      if (existingNormalized.has(normalized)) {
        duplicateCount += 1;
        return;
      }

      existingNormalized.add(normalized);

      toInsert.push({
        list_id: listId,
        name: displayName,
        quantity: "",
        priority: false,
        completed: false,
        image_url: null
      });
    });

    console.log("DA INSERIRE:", toInsert);

    if (!toInsert.length) {
      const bits = [];
      if (duplicateCount) bits.push(`${duplicateCount} già presenti`);
      if (ignoredCount) bits.push(`${ignoredCount} ignorati`);
      showToast(bits.length ? `Niente da aggiungere · ${bits.join(" · ")}` : "Niente da aggiungere.");
      return;
    }

    try {
      const { error } = await state.shoppingSupabaseClient
        .from(SHOPPING_ITEMS_TABLE)
        .insert(toInsert);

      if (error) {
        console.error("ERRORE INSERT:", error);
        throw error;
      }

      await fetchShoppingItems(listId);

      const bits = [`Aggiunti ${toInsert.length}`];
      if (duplicateCount) bits.push(`${duplicateCount} già presenti`);
      if (ignoredCount) bits.push(`${ignoredCount} ignorati`);
      showToast(bits.join(" · "));
    } catch (error) {
      console.error("Errore inserimento ingredienti spesa:", error);
      showToast("Non sono riuscito ad aggiungere gli ingredienti alla lista.");
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

    if (els.heroShoppingBtn) {
      els.heroShoppingBtn.addEventListener("click", () => {
        scrollToElement(els.shoppingPanel);
      });
    }

    if (els.shoppingListSelect) {
      els.shoppingListSelect.addEventListener("change", async (event) => {
        state.selectedShoppingListId = String(event.target.value || "");
        saveStoredShoppingListId(state.selectedShoppingListId);
        await fetchShoppingItems(state.selectedShoppingListId);
      });
    }

    if (els.shoppingRefreshBtn) {
      els.shoppingRefreshBtn.addEventListener("click", async () => {
        await fetchShoppingLists();
        showToast("Lista della spesa aggiornata.");
      });
    }

    if (els.shoppingOpenBtn) {
      els.shoppingOpenBtn.addEventListener("click", () => {
        openFullShoppingApp();
      });
    }

    els.closeCookModeBtn.addEventListener("click", closeCookMode);

    els.prevStepBtn.addEventListener("click", () => {
      if (!state.currentRecipe) return;
      state.currentStepIndex = Math.max(0, state.currentStepIndex - 1);
      updateCookStep();
    });

    els.nextStepBtn.addEventListener("click", () => {
      if (!state.currentRecipe) return;

      const totalSteps = Math.max(state.currentRecipe.steps.length, 1);
      const isLastStep = state.currentStepIndex >= totalSteps - 1;

      if (isLastStep) {
        completeCurrentRecipe();
        return;
      }

      state.currentStepIndex = Math.min(totalSteps - 1, state.currentStepIndex + 1);
      updateCookStep();
    });

    els.repeatStepBtn.addEventListener("click", () => {
      updateCookStep();
      speak(els.currentStepText.textContent);
      showToast("Step ripetuto.");
    });

    els.speakStepBtn.addEventListener("click", () => {
      speak(els.currentStepText.textContent);
    });

    els.stopSpeechBtn.addEventListener("click", () => {
      stopSpeech();
      showToast("Voce fermata.");
    });

    els.voiceToggleBtn.addEventListener("click", () => {
      toggleVoiceRecognition();
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

  async function init() {
    initDocumentMeta();
    state.supabaseClient = createSupabaseClient();
    state.shoppingSupabaseClient = createShoppingSupabaseClient();
    setFunMessage();
    loadTimers();
    renderTimers();
    bindEvents();
    fetchRecipes();
    await fetchShoppingLists();
    hideSplash();
    registerServiceWorker();
    setVoiceToggleUi(false);

    setInterval(tickTimers, 1000);
  }

  init();
})();