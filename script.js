const themeStorageKey = "hotheads-network-theme-v1";
const audioStorageKey = "hotheads-network-audio-v1";
const audioVolumeStorageKey = "hotheads-network-audio-volume-v1";
const adminSessionStorageKey = "hotheads-network-admin-session-v1";
const operatorsCacheStorageKey = "hotheads-network-operators-cache-v1";
const googleScriptWebAppUrl = "https://script.google.com/macros/s/AKfycbzv7c73FZqQqEt0_94esvri1_xKnDbu_G_FEMNdC28OVqWAZj2fKYGBX8OLrOTQbLez1g/exec";
const validThemes = new Set(["inferno", "toxic", "abyss"]);
const audioMasterMultiplier = 2;
const ambientMultiplier = 2;
const isFirefox = /firefox/i.test(window.navigator.userAgent);

const themeGate = document.querySelector("[data-theme-gate]");
const themeChoices = document.querySelectorAll("[data-theme-choice]");
const themeToggles = document.querySelectorAll("[data-theme-toggle]");
const themeConfirm = document.querySelector("[data-theme-confirm]");
const welcomeBg = document.querySelector("[data-welcome-bg]");
const welcomeLogo = document.querySelector("[data-welcome-logo]");
const topControls = document.querySelector(".top-controls");
const audioToggle = document.querySelector("[data-audio-toggle]");
const audioState = document.querySelector("[data-audio-state]");
const audioVolumeSlider = document.querySelector("[data-audio-volume]");
const adminToggle = document.querySelector("[data-admin-toggle]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminCloseButtons = document.querySelectorAll("[data-admin-close]");
const rulesPanel = document.querySelector("[data-rules-panel]");
const rulesOpenButtons = document.querySelectorAll("[data-rules-open]");
const rulesCloseButtons = document.querySelectorAll("[data-rules-close]");
const rulesConfirmButton = document.querySelector("[data-rules-confirm]");
const adminLoginForm = document.querySelector("[data-admin-login]");
const adminPasswordInput = document.querySelector("[data-admin-password]");
const adminPasswordToggle = document.querySelector("[data-admin-password-toggle]");
const adminAuthView = document.querySelector("[data-admin-auth]");
const adminDashboard = document.querySelector("[data-admin-dashboard]");
const adminRole = document.querySelector("[data-admin-role]");
const adminName = document.querySelector("[data-admin-name]");
const adminCapabilities = document.querySelector("[data-admin-capabilities]");
const adminLogout = document.querySelector("[data-admin-logout]");
const adminSheetAccess = document.querySelector("[data-admin-sheet-access]");
const copyCaButtons = document.querySelectorAll("[data-copy-ca]");
const socialPlaceholders = document.querySelectorAll("[data-social-placeholder]");
const operatorRosters = document.querySelectorAll("[data-operator-roster]");
const operatorForms = document.querySelectorAll("[data-operator-form]");
const stageViewport = document.querySelector(".stage-viewport");
const stageTrack = document.querySelector("[data-stage-track]");
const stagePanels = document.querySelectorAll("[data-stage-panel]");
const stageNavButtons = document.querySelectorAll("[data-stage-nav]");
const networkForm = document.querySelector("[data-network-form]");
const intakeSubmitButton = document.querySelector("[data-intake-submit]");
const intakeSuccess = document.querySelector("[data-intake-success]");
const interactiveNodes = document.querySelectorAll("button, a");

const themeBackgrounds = {
  inferno: "../assets/hh-bg-website-4k.png",
  toxic: "../assets/hh-bg-website-4k-toxic.jpg",
  abyss: "../assets/hh-bg-website-4k-abyss.jpg",
};

const themeLogos = {
  inferno: "../assets/loho-hh-export-3.png",
  toxic: "../assets/loho-hh-export-3-toxic.png",
  abyss: "../assets/loho-hh-export-3-abyss.png",
};

let audioContext = null;
let welcomeAmbient = null;
let audioEnabled = window.localStorage.getItem(audioStorageKey) !== "off";
let audioVolume = Math.min(1, Math.max(0, Number(window.localStorage.getItem(audioVolumeStorageKey) || "1")));
let currentStageIndex = 1;
const stageOrder = ["projects", "welcome", "apply"];
const stageTransitionMs = isFirefox ? 620 : 820;
const adminPanelTransitionMs = 300;
let isStageAnimating = false;
let mobileStageScrollTimer = null;
let adminPanelCloseTimer = null;
let adminSession = null;
let rulesAccepted = false;

const adminUsers = [
  {
    username: "opslead",
    password: "hotheads-admin",
    role: "admin",
    name: "Ops Lead",
  },
  {
    username: "campaign",
    password: "hotheads-editor",
    role: "editor",
    name: "Campaign Editor",
  },
  {
    username: "viewer",
    password: "hotheads-view",
    role: "viewer",
    name: "Read Only",
  },
];

const adminRoleCapabilities = {
  admin: [
    {
      title: "Full Control",
      body: "Manage campaign cards, rotate credentials, and control all operator-facing states.",
    },
    {
      title: "Role Management",
      body: "Grant access levels for admins, editors, and viewers across the network surface.",
    },
    {
      title: "System Oversight",
      body: "Review intake submissions, campaign links, and milestone progression from one place.",
    },
  ],
  editor: [
    {
      title: "Campaign Editing",
      body: "Update active cards, milestone states, social links, and operator roster content.",
    },
    {
      title: "Roster Control",
      body: "Maintain the joined operators list and verify social/contract metadata per campaign.",
    },
    {
      title: "Submission Review",
      body: "Inspect intake entries and prepare operator data for internal action.",
    },
  ],
  viewer: [
    {
      title: "Read Only Access",
      body: "Inspect live campaign status, roster health, and operator intake without edit rights.",
    },
    {
      title: "Audit Trail",
      body: "Track who joined, which milestones hit, and what information was submitted.",
    },
  ],
};

const campaignOperatorsState = {
  brent: [],
};

const campaignOperatorsLoadState = {
  brent: false,
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const canManageOperators = () =>
  Boolean(adminSession && (adminSession.role === "admin" || adminSession.role === "editor"));

const readOperatorsCache = () => {
  try {
    const raw = window.localStorage.getItem(operatorsCacheStorageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeOperatorsCache = (campaignId, operators) => {
  const cache = readOperatorsCache();
  cache[campaignId] = Array.isArray(operators) ? operators : [];
  window.localStorage.setItem(operatorsCacheStorageKey, JSON.stringify(cache));
};

const readCampaignOperatorsFromCache = (campaignId) => {
  const cache = readOperatorsCache();
  const operators = cache[campaignId];
  return Array.isArray(operators) ? operators : [];
};

document.body.classList.toggle("is-firefox", isFirefox);

const submitIntakeToGoogleSheets = async (payload) => {
  if (!googleScriptWebAppUrl) {
    throw new Error("Google Sheets endpoint not configured");
  }

  await fetch(googleScriptWebAppUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
};

const submitOperatorToGoogleSheets = async (payload) => {
  if (!googleScriptWebAppUrl) {
    throw new Error("Google Sheets endpoint not configured");
  }

  await fetch(googleScriptWebAppUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      type: "addOperator",
      ...payload,
    }),
  });
};

const deleteOperatorFromGoogleSheets = async (payload) => {
  const response = await requestGoogleScriptJsonp({
    action: "deleteOperator",
    campaign_id: payload.campaign_id,
    operator_handle: payload.operator_handle,
    removed_by: payload.removed_by || "",
  });

  if (!response || !response.ok || !response.deleted) {
    throw new Error("Operator could not be deleted from Google Sheets");
  }

  return response;
};

const requestGoogleScriptJsonp = (params) =>
  new Promise((resolve, reject) => {
    if (!googleScriptWebAppUrl) {
      reject(new Error("Google Sheets endpoint not configured"));
      return;
    }

    const callbackName = `__hhJsonp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ ...params, callback: callbackName });
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout"));
    }, 7000);

    window[callbackName] = (data) => {
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      reject(new Error("JSONP failed"));
    };

    script.src = `${googleScriptWebAppUrl}?${query.toString()}`;
    document.body.appendChild(script);
  });

const ensureAudio = async () => {
  if (!window.AudioContext && !window.webkitAudioContext) {
    return null;
  }

  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return audioContext;
};

const playTone = async ({
  frequency = 440,
  duration = 0.1,
  type = "sine",
  volume = 0.018,
  endFrequency = null,
} = {}) => {
  const audio = await ensureAudio();
  if (!audio) {
    return;
  }

  const oscillator = audio.createOscillator();
  const gainNode = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      audio.currentTime + duration
    );
  }

  gainNode.gain.setValueAtTime(0.0001, audio.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.min(1, volume * audioMasterMultiplier * audioVolume),
    audio.currentTime + 0.01
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration + 0.03);
};

const playFilteredNoise = async ({
  duration = 0.04,
  volume = 0.008,
  filterType = "bandpass",
  frequency = 1800,
  q = 0.9,
} = {}) => {
  const audio = await ensureAudio();
  if (!audio) {
    return;
  }

  const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gainNode = audio.createGain();
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, audio.currentTime);
  filter.Q.setValueAtTime(q, audio.currentTime);
  gainNode.gain.setValueAtTime(
    Math.min(1, volume * audioMasterMultiplier * audioVolume),
    audio.currentTime
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audio.destination);
  source.start();
};

const uiSound = (kind) => {
  if (!audioEnabled) {
    return;
  }

  if (kind === "hover") {
    playTone({ frequency: 210, endFrequency: 250, duration: 0.09, volume: 0.01, type: "sine" });
    playTone({ frequency: 420, endFrequency: 500, duration: 0.08, volume: 0.0048, type: "triangle" });
    playFilteredNoise({ duration: 0.035, volume: 0.0022, frequency: 1200, q: 0.7 });
  }

  if (kind === "click") {
    playTone({ frequency: 180, endFrequency: 230, duration: 0.11, volume: 0.014, type: "triangle" });
    playTone({ frequency: 360, endFrequency: 430, duration: 0.09, volume: 0.005, type: "sine" });
  }

  if (kind === "theme") {
    playTone({ frequency: 190, endFrequency: 240, duration: 0.16, volume: 0.016, type: "triangle" });
    playTone({ frequency: 380, endFrequency: 470, duration: 0.18, volume: 0.006, type: "sine" });
    window.setTimeout(() => {
      playTone({ frequency: 270, endFrequency: 340, duration: 0.16, volume: 0.006, type: "triangle" });
    }, 70);
  }

  if (kind === "confirm") {
    playTone({ frequency: 150, endFrequency: 220, duration: 0.22, volume: 0.02, type: "triangle" });
    playTone({ frequency: 300, endFrequency: 420, duration: 0.24, volume: 0.008, type: "sine" });
    playTone({ frequency: 600, endFrequency: 720, duration: 0.18, volume: 0.0035, type: "triangle" });
    playFilteredNoise({ duration: 0.06, volume: 0.0028, frequency: 1100, q: 0.6 });
  }
};

const stopWelcomeAmbient = () => {
  if (!welcomeAmbient || !audioContext) {
    welcomeAmbient = null;
    return;
  }

  const { oscillator, gainNode } = welcomeAmbient;
  gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  gainNode.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.08);
  window.setTimeout(() => {
    try {
      oscillator.stop();
    } catch {}
  }, 220);

  welcomeAmbient = null;
};

const syncAudioUi = () => {
  if (!audioToggle || !audioState) {
    return;
  }

  const isMuted = !audioEnabled || audioVolume <= 0;
  const nextLabel = isMuted ? "Unmute audio" : "Mute audio";
  audioToggle.classList.toggle("is-muted", isMuted);
  audioToggle.setAttribute("aria-pressed", isMuted ? "false" : "true");
  audioToggle.setAttribute("aria-label", nextLabel);
  audioToggle.setAttribute("title", nextLabel);
  audioState.textContent = isMuted ? "Muted" : "On";

  if (audioVolumeSlider) {
    const nextVolume = Math.round(audioVolume * 100);
    audioVolumeSlider.value = String(nextVolume);
    audioVolumeSlider.disabled = !audioEnabled;
    audioVolumeSlider.setAttribute("aria-label", `Audio volume ${nextVolume}%`);
  }
};

const syncRulesUi = () => {
  if (intakeSubmitButton) {
    intakeSubmitButton.disabled = false;
    intakeSubmitButton.classList.toggle("is-locked", !rulesAccepted);
    intakeSubmitButton.setAttribute("aria-disabled", rulesAccepted ? "false" : "true");
  }

  rulesOpenButtons.forEach((button) => {
    button.classList.remove("is-invalid");
    button.classList.toggle("is-confirmed", rulesAccepted);
    const label = button.querySelector(".welcome-button__label");
    if (label) {
      label.textContent = rulesAccepted ? "Rules Confirmed" : "View Full Rules";
    }
  });
};

const renderAdminCapabilities = (role) => {
  if (!adminCapabilities) {
    return;
  }

  const items = adminRoleCapabilities[role] || [];
  adminCapabilities.innerHTML = items
    .map(
      (item) => `
        <article class="admin-capability">
          <strong>${item.title}</strong>
          <span>${item.body}</span>
        </article>
      `
    )
    .join("");
};

const syncAdminUi = () => {
  if (!adminAuthView || !adminDashboard || !adminRole || !adminName) {
    return;
  }

  const isLoggedIn = Boolean(adminSession);
  adminAuthView.hidden = isLoggedIn;
  adminDashboard.hidden = !isLoggedIn;
  adminAuthView.setAttribute("aria-hidden", isLoggedIn ? "true" : "false");
  adminDashboard.setAttribute("aria-hidden", isLoggedIn ? "false" : "true");
  const canAccessSheet = isLoggedIn && (adminSession.role === "admin" || adminSession.role === "editor");
  const canManageOperators = canAccessSheet;
  if (adminSheetAccess) {
    adminSheetAccess.hidden = !canAccessSheet;
  }
  operatorForms.forEach((form) => {
    form.hidden = !canManageOperators;
  });
  Object.keys(campaignOperatorsState).forEach((campaignId) => {
    renderOperatorRoster(campaignId);
  });

  if (!isLoggedIn) {
    if (adminCapabilities) {
      adminCapabilities.innerHTML = "";
    }
    return;
  }

  adminRole.textContent = adminSession.role;
  adminName.textContent = adminSession.name;
  renderAdminCapabilities(adminSession.role);
};

const renderOperatorRoster = (campaignId) => {
  const roster = document.querySelector(`[data-operator-roster="${campaignId}"]`);
  if (!roster) {
    return;
  }

  const grid = roster.querySelector("[data-operator-grid]");
  const count = roster.querySelector("[data-operator-count]");
  const operators = Array.isArray(campaignOperatorsState[campaignId])
    ? campaignOperatorsState[campaignId]
    : [];
  const showDelete = canManageOperators();

  if (count) {
    count.textContent = `${operators.length} Joined`;
  }

  if (!grid) {
    return;
  }

  if (!campaignOperatorsLoadState[campaignId]) {
    grid.innerHTML = '<span class="operator-roster__empty">Loading operators...</span>';
    return;
  }

  if (!operators.length) {
    grid.innerHTML = '<span class="operator-roster__empty">No operators added yet.</span>';
    return;
  }

  grid.innerHTML = operators
    .map(
      (handle) => `
        <span class="operator-pill">
          <span class="operator-pill__dot"></span>
          <span class="operator-pill__handle">${escapeHtml(handle)}</span>
          ${
            showDelete
              ? `<button
                  class="operator-pill__remove"
                  type="button"
                  aria-label="Remove ${escapeHtml(handle)}"
                  data-operator-remove="${escapeHtml(handle)}"
                  data-operator-campaign="${campaignId}"
                >&times;</button>`
              : ""
          }
        </span>
      `
    )
    .join("");
};

const loadCampaignOperators = async (campaignId) => {
  let didLoadFromSheet = false;

  try {
    const response = await requestGoogleScriptJsonp({
      action: "listOperators",
      campaign_id: campaignId,
    });

      if (response && response.ok && Array.isArray(response.operators)) {
        const nextOperators = response.operators
          .map((entry) => String(entry.operator_handle || "").trim())
          .filter(Boolean);

        campaignOperatorsState[campaignId] = Array.from(new Set(nextOperators));
        writeOperatorsCache(campaignId, campaignOperatorsState[campaignId]);
        didLoadFromSheet = true;
      }
  } catch {}

  if (!didLoadFromSheet) {
    campaignOperatorsState[campaignId] = readCampaignOperatorsFromCache(campaignId);
  }

  campaignOperatorsLoadState[campaignId] = true;

  renderOperatorRoster(campaignId);
};

const openAdminPanel = () => {
  if (!adminPanel) {
    return;
  }

  window.clearTimeout(adminPanelCloseTimer);
  adminPanel.hidden = false;
  adminPanel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    adminPanel.classList.add("is-open");
  });
  uiSound("click");
  syncAdminUi();
};

const closeAdminPanel = () => {
  if (!adminPanel) {
    return;
  }

  adminPanel.classList.remove("is-open");
  adminPanel.setAttribute("aria-hidden", "true");
  window.clearTimeout(adminPanelCloseTimer);
  adminPanelCloseTimer = window.setTimeout(() => {
    adminPanel.hidden = true;
  }, adminPanelTransitionMs);
};

const openRulesPanel = () => {
  if (!rulesPanel) {
    return;
  }

  rulesPanel.hidden = false;
  rulesPanel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    rulesPanel.classList.add("is-open");
  });
  uiSound("click");
};

const closeRulesPanel = () => {
  if (!rulesPanel) {
    return;
  }

  rulesPanel.classList.remove("is-open");
  rulesPanel.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (rulesPanel && !rulesPanel.classList.contains("is-open")) {
      rulesPanel.hidden = true;
    }
  }, adminPanelTransitionMs);
};

const startWelcomeAmbient = async () => {
  if (!audioEnabled || welcomeAmbient) {
    return;
  }

  const audio = await ensureAudio();
  if (!audio) {
    return;
  }

  const oscillator = audio.createOscillator();
  const gainNode = audio.createGain();
  const filterNode = audio.createBiquadFilter();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(92, audio.currentTime);
  filterNode.type = "lowpass";
  filterNode.frequency.setValueAtTime(240, audio.currentTime);
  gainNode.gain.setValueAtTime(0.0001, audio.currentTime);

  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(audio.destination);
  oscillator.start();
  gainNode.gain.setTargetAtTime(
    Math.min(1, 0.0045 * audioMasterMultiplier * ambientMultiplier * audioVolume),
    audio.currentTime,
    0.9
  );

  welcomeAmbient = { oscillator, gainNode, filterNode };
};

const updateWelcomeAmbientLevel = () => {
  if (!welcomeAmbient || !audioContext) {
    return;
  }

  const target = audioEnabled
    ? Math.min(1, 0.0045 * audioMasterMultiplier * ambientMultiplier * audioVolume)
    : 0.0001;
  welcomeAmbient.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  welcomeAmbient.gainNode.gain.setTargetAtTime(target, audioContext.currentTime, 0.12);
};

const storedTheme = window.localStorage.getItem(themeStorageKey);
const initialTheme = validThemes.has(storedTheme) ? storedTheme : "inferno";
const storedAdminSession = window.localStorage.getItem(adminSessionStorageKey);

if (storedAdminSession) {
  try {
    adminSession = JSON.parse(storedAdminSession);
  } catch {
    adminSession = null;
  }
}

let welcomeBgSwapId = 0;
let welcomeLogoSwapId = 0;

const swapWelcomeBackground = (theme, immediate = false) => {
  if (!welcomeBg) {
    return;
  }

  const nextSrc = themeBackgrounds[theme] || themeBackgrounds.inferno;
  if (immediate) {
    welcomeBg.style.backgroundImage = `linear-gradient(180deg, rgba(16, 6, 2, 0.42), rgba(6, 2, 1, 0.76)), url("${nextSrc}")`;
    welcomeBg.classList.remove("is-switching");
    return;
  }

  const requestId = ++welcomeBgSwapId;
  const image = new Image();
  image.onload = () => {
    if (requestId !== welcomeBgSwapId) {
      return;
    }

    welcomeBg.classList.add("is-switching");
    window.setTimeout(() => {
      if (requestId !== welcomeBgSwapId) {
        return;
      }

      welcomeBg.style.backgroundImage = `linear-gradient(180deg, rgba(16, 6, 2, 0.42), rgba(6, 2, 1, 0.76)), url("${nextSrc}")`;
      window.setTimeout(() => {
        if (requestId === welcomeBgSwapId) {
          welcomeBg.classList.remove("is-switching");
        }
      }, 120);
    }, 140);
  };
  image.src = nextSrc;
};

const swapWelcomeLogo = (theme, immediate = false) => {
  if (!welcomeLogo) {
    return;
  }

  const nextSrc = themeLogos[theme] || themeLogos.inferno;
  if (immediate) {
    welcomeLogo.src = nextSrc;
    welcomeLogo.classList.remove("is-switching");
    return;
  }

  if (welcomeLogo.getAttribute("src") === nextSrc) {
    return;
  }

  const requestId = ++welcomeLogoSwapId;
  const image = new Image();
  image.onload = () => {
    if (requestId !== welcomeLogoSwapId) {
      return;
    }

    welcomeLogo.classList.add("is-switching");
    window.setTimeout(() => {
      if (requestId !== welcomeLogoSwapId) {
        return;
      }

      welcomeLogo.src = nextSrc;
      window.setTimeout(() => {
        if (requestId === welcomeLogoSwapId) {
          welcomeLogo.classList.remove("is-switching");
        }
      }, 80);
    }, 120);
  };
  image.src = nextSrc;
};

const applyTheme = (theme, immediate = false) => {
  if (!validThemes.has(theme)) {
    return;
  }

  document.body.dataset.theme = theme;
  themeChoices.forEach((choice) => {
    choice.classList.toggle("is-active", choice.dataset.themeChoice === theme);
  });
  themeToggles.forEach((toggle) => {
    toggle.classList.toggle("is-active", toggle.dataset.themeToggle === theme);
  });

  swapWelcomeBackground(theme, immediate);
  swapWelcomeLogo(theme, immediate);
};

applyTheme(initialTheme, true);
syncAudioUi();
syncRulesUi();
syncAdminUi();

const syncStageUi = () => {
  if (window.innerWidth <= 1000) {
    stagePanels.forEach((panel, index) => {
      panel.classList.toggle("is-active", index === currentStageIndex);
      panel.classList.remove("is-before", "is-after");
    });
  } else {
  stagePanels.forEach((panel, index) => {
    panel.classList.toggle("is-active", index === currentStageIndex);
    panel.classList.toggle("is-before", index < currentStageIndex);
    panel.classList.toggle("is-after", index > currentStageIndex);
  });
  }

  const prevButton = document.querySelector('[data-stage-nav="prev"]');
  const nextButton = document.querySelector('[data-stage-nav="next"]');

  if (prevButton) {
    const prevTarget = currentStageIndex === 2 ? 1 : 0;
    const prevDisabled = currentStageIndex === 0;
    prevButton.classList.toggle("is-disabled", prevDisabled);
    prevButton.disabled = prevDisabled;
    prevButton.dataset.stageTarget = String(prevTarget);
    const prevLabel = prevButton.querySelector(".stage-nav__label");
    if (prevLabel) {
      prevLabel.textContent = currentStageIndex === 2 ? "Back" : "Projects";
    }
  }

  if (nextButton) {
    const nextTarget = currentStageIndex === 0 ? 1 : 2;
    const nextDisabled = currentStageIndex === 2;
    nextButton.classList.toggle("is-disabled", nextDisabled);
    nextButton.disabled = nextDisabled;
    nextButton.dataset.stageTarget = String(nextTarget);
    const nextLabel = nextButton.querySelector(".stage-nav__label");
    if (nextLabel) {
      nextLabel.textContent = currentStageIndex === 0 ? "Back" : "Apply";
    }
  }

};

const goToStage = (nextIndex) => {
  const clampedIndex = Math.max(0, Math.min(stageOrder.length - 1, nextIndex));
  if (clampedIndex === currentStageIndex || isStageAnimating) {
    return;
  }

  const direction = clampedIndex > currentStageIndex ? "forward" : "backward";
  const outgoingPanel = stagePanels[currentStageIndex];
  const incomingPanel = stagePanels[clampedIndex];
  if (!outgoingPanel || !incomingPanel) {
    currentStageIndex = clampedIndex;
    syncStageUi();
    uiSound("theme");
    return;
  }

  isStageAnimating = true;
  stagePanels.forEach((panel) => {
    panel.classList.remove(
      "is-entering-from-right",
      "is-entering-from-left",
      "is-exiting-to-left",
      "is-exiting-to-right"
    );
  });

  incomingPanel.classList.add(direction === "forward" ? "is-entering-from-right" : "is-entering-from-left");
  outgoingPanel.classList.add(direction === "forward" ? "is-exiting-to-left" : "is-exiting-to-right");

  currentStageIndex = clampedIndex;
  syncStageUi();
  uiSound("theme");

  window.setTimeout(() => {
    stagePanels.forEach((panel) => {
      panel.classList.remove(
        "is-entering-from-right",
        "is-entering-from-left",
        "is-exiting-to-left",
        "is-exiting-to-right"
      );
    });
    syncStageUi();
    isStageAnimating = false;
  }, stageTransitionMs);
};

syncStageUi();
Object.keys(campaignOperatorsState).forEach((campaignId) => {
  renderOperatorRoster(campaignId);
  loadCampaignOperators(campaignId);
});

const syncMobileStagePosition = (behavior = "auto") => {
  if (!stageViewport || window.innerWidth > 1000) {
    return;
  }

  const targetLeft = stageViewport.clientWidth * currentStageIndex;
  stageViewport.scrollTo({ left: targetLeft, behavior });
};

window.addEventListener("resize", () => {
  if (window.innerWidth <= 1000) {
    syncMobileStagePosition("auto");
  }
});

if (stageViewport) {
  window.addEventListener("load", () => {
    syncMobileStagePosition("auto");
  });

  stageViewport.addEventListener("scroll", () => {
    if (window.innerWidth > 1000) {
      return;
    }

    window.clearTimeout(mobileStageScrollTimer);
    mobileStageScrollTimer = window.setTimeout(() => {
      const nextIndex = Math.round(stageViewport.scrollLeft / Math.max(1, stageViewport.clientWidth));
      currentStageIndex = Math.max(0, Math.min(stageOrder.length - 1, nextIndex));
      syncStageUi();
    }, 80);
  });
}

if (topControls) {
  topControls.addEventListener("pointerenter", () => {
    topControls.classList.add("is-expanded");
  });

  topControls.addEventListener("pointerleave", () => {
    topControls.classList.remove("is-expanded");
  });
}

const setWelcomeParallax = (clientX, clientY) => {
  const offsetX = (clientX / window.innerWidth - 0.5) * 32;
  const offsetY = (clientY / window.innerHeight - 0.5) * 24;
  document.documentElement.style.setProperty("--welcome-bg-shift-x", `${offsetX}px`);
  document.documentElement.style.setProperty("--welcome-bg-shift-y", `${offsetY}px`);
};

window.addEventListener("mousemove", (event) => {
  setWelcomeParallax(event.clientX, event.clientY);
});

window.addEventListener("mouseleave", () => {
  document.documentElement.style.setProperty("--welcome-bg-shift-x", "0px");
  document.documentElement.style.setProperty("--welcome-bg-shift-y", "0px");
});

window.addEventListener(
  "pointerdown",
  () => {
    ensureAudio();
  },
  { once: true }
);

interactiveNodes.forEach((node) => {
  node.addEventListener("pointerenter", () => {
    uiSound("hover");
  });

  node.addEventListener("click", () => {
    if (node.hasAttribute("data-audio-toggle")) {
      return;
    }

    uiSound("click");
  });
});

if (audioToggle) {
  audioToggle.addEventListener("click", async () => {
    audioEnabled = !audioEnabled;
    window.localStorage.setItem(audioStorageKey, audioEnabled ? "on" : "off");
    syncAudioUi();

    if (audioEnabled) {
      await ensureAudio();
      uiSound("click");
      startWelcomeAmbient();
      return;
    }

    stopWelcomeAmbient();
  });
}

if (audioVolumeSlider) {
  audioVolumeSlider.addEventListener("input", () => {
    audioVolume = Math.min(1, Math.max(0, Number(audioVolumeSlider.value) / 100));
    window.localStorage.setItem(audioVolumeStorageKey, String(audioVolume));
    updateWelcomeAmbientLevel();
    syncAudioUi();
  });

  const releaseAudioSliderFocus = () => {
    audioVolumeSlider.blur();
  };

  audioVolumeSlider.addEventListener("change", releaseAudioSliderFocus);
  audioVolumeSlider.addEventListener("pointerup", releaseAudioSliderFocus);
  audioVolumeSlider.addEventListener("touchend", releaseAudioSliderFocus);
}

if (adminToggle) {
  adminToggle.addEventListener("click", () => {
    if (adminPanel && !adminPanel.hidden) {
      closeAdminPanel();
      return;
    }

    openAdminPanel();
  });
}

adminCloseButtons.forEach((button) => {
  button.addEventListener("click", closeAdminPanel);
});

rulesOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openRulesPanel();
  });
});

rulesCloseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    closeRulesPanel();
  });
});

if (rulesConfirmButton) {
  rulesConfirmButton.addEventListener("click", () => {
    rulesAccepted = true;
    syncRulesUi();
    uiSound("confirm");
    closeRulesPanel();
  });
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(adminLoginForm);
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();
    const matchedUser = adminUsers.find(
      (user) => user.username.toLowerCase() === username && user.password === password
    );

    if (!matchedUser) {
      adminLoginForm.classList.remove("is-invalid");
      void adminLoginForm.offsetWidth;
      adminLoginForm.classList.add("is-invalid");
      return;
    }

    adminSession = {
      username: matchedUser.username,
      role: matchedUser.role,
      name: matchedUser.name,
    };
    window.localStorage.setItem(adminSessionStorageKey, JSON.stringify(adminSession));
    adminLoginForm.reset();
    adminLoginForm.classList.remove("is-invalid");
    syncAdminUi();
    uiSound("confirm");
  });
}

operatorForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!adminSession || (adminSession.role !== "admin" && adminSession.role !== "editor")) {
      return;
    }

    const campaignId = form.dataset.operatorForm;
    const input = form.querySelector(".operator-entry__input");
    const submitButton = form.querySelector(".operator-entry__submit");
    if (!campaignId || !input || !submitButton) {
      return;
    }

    const normalizedHandle = String(input.value || "")
      .trim()
      .replace(/\s+/g, "");
    const operatorHandle = normalizedHandle.startsWith("@")
      ? normalizedHandle
      : `@${normalizedHandle}`;

    if (operatorHandle.length < 2) {
      input.classList.remove("is-invalid");
      void input.offsetWidth;
      input.classList.add("is-invalid");
      return;
    }

    input.classList.remove("is-invalid");
    const currentOperators = campaignOperatorsState[campaignId] || [];
    const exists = currentOperators.some(
      (handle) => handle.toLowerCase() === operatorHandle.toLowerCase()
    );
    if (exists) {
      input.classList.remove("is-invalid");
      void input.offsetWidth;
      input.classList.add("is-invalid");
      return;
    }

    campaignOperatorsState[campaignId] = [...currentOperators, operatorHandle];
    writeOperatorsCache(campaignId, campaignOperatorsState[campaignId]);
    renderOperatorRoster(campaignId);
    input.value = "";
    submitButton.classList.add("is-saved");
    uiSound("confirm");

    window.setTimeout(() => {
      submitButton.classList.remove("is-saved");
    }, 1200);

    submitOperatorToGoogleSheets({
      campaign_id: campaignId,
      operator_handle: operatorHandle,
      added_by: adminSession.username,
      status: "active",
    }).catch(() => {
      campaignOperatorsState[campaignId] = currentOperators;
      writeOperatorsCache(campaignId, campaignOperatorsState[campaignId]);
      renderOperatorRoster(campaignId);
      input.classList.remove("is-invalid");
      void input.offsetWidth;
      input.classList.add("is-invalid");
    });
  });
});

operatorRosters.forEach((roster) => {
  roster.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-operator-remove]");
    if (!removeButton || !canManageOperators()) {
      return;
    }

    const campaignId = removeButton.getAttribute("data-operator-campaign");
    const operatorHandle = removeButton.getAttribute("data-operator-remove");
    if (!campaignId || !operatorHandle) {
      return;
    }

    const currentOperators = campaignOperatorsState[campaignId] || [];
    const nextOperators = currentOperators.filter(
      (handle) => handle.toLowerCase() !== operatorHandle.toLowerCase()
    );

    if (nextOperators.length === currentOperators.length) {
      return;
    }

    campaignOperatorsState[campaignId] = nextOperators;
    writeOperatorsCache(campaignId, campaignOperatorsState[campaignId]);
    renderOperatorRoster(campaignId);
    uiSound("click");

    deleteOperatorFromGoogleSheets({
      campaign_id: campaignId,
      operator_handle: operatorHandle,
      removed_by: adminSession?.username || "",
    }).catch(() => {
      campaignOperatorsState[campaignId] = currentOperators;
      writeOperatorsCache(campaignId, campaignOperatorsState[campaignId]);
      renderOperatorRoster(campaignId);
    });
  });
});

if (adminPasswordInput && adminPasswordToggle) {
  const revealAdminPassword = () => {
    adminPasswordInput.type = "text";
  };

  const hideAdminPassword = () => {
    adminPasswordInput.type = "password";
  };

  adminPasswordToggle.addEventListener("mouseenter", revealAdminPassword);
  adminPasswordToggle.addEventListener("mouseleave", hideAdminPassword);
  adminPasswordToggle.addEventListener("focus", revealAdminPassword);
  adminPasswordToggle.addEventListener("blur", hideAdminPassword);
  adminPasswordToggle.addEventListener("pointerdown", revealAdminPassword);
  adminPasswordToggle.addEventListener("pointerup", hideAdminPassword);
  adminPasswordToggle.addEventListener("touchstart", revealAdminPassword, { passive: true });
  adminPasswordToggle.addEventListener("touchend", hideAdminPassword);
  adminPasswordToggle.addEventListener("touchcancel", hideAdminPassword);
}

if (adminLogout) {
  adminLogout.addEventListener("click", () => {
    adminSession = null;
    window.localStorage.removeItem(adminSessionStorageKey);
    if (adminLoginForm) {
      adminLoginForm.reset();
      adminLoginForm.classList.remove("is-invalid");
    }
    syncAdminUi();
    uiSound("click");
    closeAdminPanel();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && adminPanel && !adminPanel.hidden) {
    closeAdminPanel();
  }
  if (event.key === "Escape" && rulesPanel && !rulesPanel.hidden) {
    closeRulesPanel();
  }
});

themeChoices.forEach((choice) => {
  choice.addEventListener("click", () => {
    const theme = choice.dataset.themeChoice;
    if (!validThemes.has(theme)) {
      return;
    }

    applyTheme(theme);
    uiSound("theme");
  });
});

themeToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const theme = toggle.dataset.themeToggle;
    if (!validThemes.has(theme)) {
      return;
    }

    applyTheme(theme);
    window.localStorage.setItem(themeStorageKey, theme);
    uiSound("theme");
  });
});

stageNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }

    const explicitTarget = Number(button.dataset.stageTarget);
    if (!Number.isNaN(explicitTarget)) {
      goToStage(explicitTarget);
    }
  });
});

socialPlaceholders.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("href") === "#") {
      event.preventDefault();
      link.classList.remove("is-unavailable");
      void link.offsetWidth;
      link.classList.add("is-unavailable");
      window.setTimeout(() => {
        link.classList.remove("is-unavailable");
      }, 680);
    }
  });
});

copyCaButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const copyValue = button.dataset.copyCa;
    if (!copyValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyValue);
      button.classList.remove("is-error");
      button.classList.add("is-copied");
      button.dataset.feedback = "Copied";
      const stateNode = button.querySelector("[data-copy-state]");
      if (stateNode) {
        stateNode.textContent = "Copied";
      }
      uiSound("confirm");

      window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.dataset.feedback = "";
        if (stateNode) {
          stateNode.textContent = "Copy";
        }
      }, 1400);
    } catch {
      button.classList.remove("is-copied");
      button.classList.add("is-error");
      button.dataset.feedback = "Error";
      const stateNode = button.querySelector("[data-copy-state]");
      if (stateNode) {
        stateNode.textContent = "Error";
      }
      window.setTimeout(() => {
        button.classList.remove("is-error");
        button.dataset.feedback = "";
        if (stateNode) {
          stateNode.textContent = "Copy";
        }
      }, 1400);
    }
  });
});

if (networkForm) {
  networkForm.querySelectorAll("input, textarea, select").forEach((field) => {
    field.addEventListener("input", () => {
      const fieldName = field.getAttribute("name");
      if (!fieldName) {
        return;
      }

      const wrapper = networkForm.querySelector(`[data-required-field="${fieldName}"]`);
      if (!wrapper) {
        return;
      }

      const isValid =
        field instanceof HTMLInputElement && field.type === "checkbox"
          ? field.checked
          : field.value.trim().length > 0;
      wrapper.classList.toggle("is-invalid", !isValid);
    });
  });

  networkForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!rulesAccepted) {
      rulesOpenButtons.forEach((button) => {
        button.classList.remove("is-invalid");
        void button.offsetWidth;
        button.classList.add("is-invalid");
      });
      openRulesPanel();
      return;
    }

    const requiredFields = networkForm.querySelectorAll("[data-required-field]");
    let hasError = false;

    requiredFields.forEach((field) => {
      const key = field.getAttribute("data-required-field");
      const input = key ? networkForm.elements.namedItem(key) : null;
      let isValid = false;

      if (input instanceof HTMLInputElement && input.type === "checkbox") {
        isValid = input.checked;
      } else if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
        isValid = input.value.trim().length > 0;
      }

      field.classList.toggle("is-invalid", !isValid);
      hasError = hasError || !isValid;
    });

    if (hasError) {
      uiSound("click");
      return;
    }

    const formData = new FormData(networkForm);
    const submitButton = networkForm.querySelector(".welcome-button--intake");
    const submitLabel = submitButton?.querySelector(".welcome-button__label");
    const submitMeta = submitButton?.querySelector(".welcome-button__meta");
    const payload = {
      telegram: String(formData.get("telegram") || "").trim(),
      twitter: String(formData.get("twitter") || "").trim(),
      wallet: String(formData.get("wallet") || "").trim(),
      twitter_follow_confirm: formData.get("twitter_follow_confirm") === "on",
      rules_accepted: rulesAccepted,
    };

    if (submitButton) {
      submitButton.disabled = true;
    }
    if (submitLabel) {
      submitLabel.textContent = "Saving";
    }
    if (submitMeta) {
      submitMeta.textContent = "Pushing intake to Google Sheets.";
    }

    submitIntakeToGoogleSheets(payload)
      .then(() => {
        window.localStorage.setItem("hotheads-network-intake-draft", JSON.stringify(payload));
        if (submitButton) {
          submitButton.classList.add("is-saved");
        }
        if (intakeSuccess) {
          intakeSuccess.classList.add("is-visible");
          intakeSuccess.setAttribute("aria-hidden", "false");
        }
        if (submitLabel) {
          submitLabel.textContent = "Saved";
        }
        if (submitMeta) {
          submitMeta.textContent = "Intake sent to Google Sheets.";
        }
        uiSound("confirm");
      })
      .catch(() => {
        if (submitButton) {
          submitButton.classList.remove("is-saved");
        }
        if (submitLabel) {
          submitLabel.textContent = "Save Intake";
        }
        if (submitMeta) {
          submitMeta.textContent = "Google Sheets connection missing.";
        }
      })
      .finally(() => {
        window.setTimeout(() => {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove("is-saved");
          }
          if (intakeSuccess) {
            intakeSuccess.classList.remove("is-visible");
            intakeSuccess.setAttribute("aria-hidden", "true");
          }
          if (submitLabel) {
            submitLabel.textContent = "Save Intake";
          }
          if (submitMeta) {
            submitMeta.textContent = "Store locally for operator tracking.";
          }
        }, 1600);
      });
  });
}

if (intakeSubmitButton) {
  intakeSubmitButton.addEventListener("click", (event) => {
    if (rulesAccepted) {
      return;
    }

    event.preventDefault();
    rulesOpenButtons.forEach((button) => {
      button.classList.remove("is-invalid");
      void button.offsetWidth;
      button.classList.add("is-invalid");
    });
    uiSound("click");
  });
}

if (themeConfirm) {
  themeConfirm.addEventListener("click", () => {
    const currentTheme = document.body.dataset.theme;
    window.localStorage.setItem(themeStorageKey, currentTheme);
    uiSound("confirm");
    document.body.classList.add("is-theme-gate-leaving");

    if (themeGate) {
      themeGate.setAttribute("aria-hidden", "true");
    }

    window.setTimeout(() => {
      document.body.classList.remove("is-theme-gate", "is-theme-gate-leaving");
      startWelcomeAmbient();
    }, 340);
  });
}

if (!document.body.classList.contains("is-theme-gate")) {
  startWelcomeAmbient();
}
