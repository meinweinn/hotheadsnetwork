const themeStorageKey = "hotheads-network-theme-v1";
const audioStorageKey = "hotheads-network-audio-v1";
const googleScriptWebAppUrl = "https://script.google.com/macros/s/AKfycbw3ivKc79GDfEhbihBBcxM7QT6Lk8w3gvdPQ6tRdBmLOntSEDVUyTu4GveLUQn8qbcD/exec";
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
const copyCaButtons = document.querySelectorAll("[data-copy-ca]");
const socialPlaceholders = document.querySelectorAll("[data-social-placeholder]");
const stageViewport = document.querySelector(".stage-viewport");
const stageTrack = document.querySelector("[data-stage-track]");
const stagePanels = document.querySelectorAll("[data-stage-panel]");
const stageNavButtons = document.querySelectorAll("[data-stage-nav]");
const networkForm = document.querySelector("[data-network-form]");
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
let currentStageIndex = 1;
const stageOrder = ["projects", "welcome", "apply"];
const stageTransitionMs = isFirefox ? 620 : 820;
let isStageAnimating = false;
let mobileStageScrollTimer = null;

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
    Math.min(1, volume * audioMasterMultiplier),
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
  gainNode.gain.setValueAtTime(Math.min(1, volume * audioMasterMultiplier), audio.currentTime);
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

  const nextLabel = audioEnabled ? "Mute audio" : "Unmute audio";
  audioToggle.classList.toggle("is-muted", !audioEnabled);
  audioToggle.setAttribute("aria-pressed", audioEnabled ? "true" : "false");
  audioToggle.setAttribute("aria-label", nextLabel);
  audioToggle.setAttribute("title", nextLabel);
  audioState.textContent = audioEnabled ? "On" : "Muted";
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
    Math.min(1, 0.0045 * audioMasterMultiplier * ambientMultiplier),
    audio.currentTime,
    0.9
  );

  welcomeAmbient = { oscillator, gainNode, filterNode };
};

const storedTheme = window.localStorage.getItem(themeStorageKey);
const initialTheme = validThemes.has(storedTheme) ? storedTheme : "inferno";

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
