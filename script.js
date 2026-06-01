/* ================================================
   DICE TRAY ENGINE v2
   - SVG die icons for aptitude (red) and gear (yellow)
   - Max 2 aptitudes, max 1 gear slot (bumps on new selection)
   - Visual die-icon pool display
   - Difficulty removes dice one by one
   - Rolls via Dice+ — 3D dice appear on OBR main screen
   - Individual results shown in tray, 1s highlighted
   - Pool breakdown: 2d6 (Finesse) + 3d6 (Exert) + 2d6 (Gear)
   ================================================ */

/* -----------------------------------------------
   State
   ----------------------------------------------- */
// Ordered queue of selected aptitudes, max 2
// Each: { apt: "finesse", count: 3 }
const aptitudeQueue = [];

// Single active gear slot or null
// { slotKey: "weapon-1", label: "Weapon 1", count: 2 }
let activeGear = null;

// Last roll results (flat values)
let lastRollResults = null;

// Last render mode: "none" | "normal" | "push"
let lastRenderMode = "none";

// Last push groups (with {val, pushed}) for re-rendering
let lastPushGroups = null;

// Whether Push has already been used for the current roll
let hasPushed = false;

/* -----------------------------------------------
   Push button state helper
   ----------------------------------------------- */
function updatePushState() {
  const pushBtn = document.getElementById("dice-push-btn");
  if (!pushBtn) return;

  const hasResults =
    lastRollResults &&
    (Array.isArray(lastRollResults.apt) || Array.isArray(lastRollResults.gear));

  if (!hasResults) {
    pushBtn.disabled    = true;
    pushBtn.textContent = "Push";
  } else if (hasPushed) {
    pushBtn.disabled    = true;
    pushBtn.textContent = "Pushed";
  } else {
    pushBtn.disabled    = false;
    pushBtn.textContent = "Push";
  }
}

/* -----------------------------------------------
   Get aptitude value (trauma-adjusted if shown)
   ----------------------------------------------- */
function getAptitudeValue(apt) {
  const curEl = document.getElementById(`cur-${apt}`);
  if (curEl && curEl.textContent !== "") {
    return Math.max(0, parseInt(curEl.textContent) || 0);
  }
  return Math.max(0, parseInt(
    document.querySelector(`input[name="attr_${apt}"]`)?.value
  ) || 0);
}

/* -----------------------------------------------
   Toggle aptitude — max 2, bumps oldest
   ----------------------------------------------- */
function toggleAptitude(apt) {
  const existing = aptitudeQueue.findIndex(a => a.apt === apt);
  if (existing !== -1) {
    aptitudeQueue.splice(existing, 1);
  } else {
    if (aptitudeQueue.length >= 2) aptitudeQueue.shift();
    const count = getAptitudeValue(apt);
    aptitudeQueue.push({ apt, count }); // 0 is valid — shows 0d6
  }
  updateAptitudeIconStates();
  renderDiceTray();
  // Results intentionally NOT cleared here — dice persist until explicit Clear
}

/* -----------------------------------------------
   Toggle gear — max 1, bumps previous
   ----------------------------------------------- */
function toggleGear(slotKey, label, count) {
  if (activeGear?.slotKey === slotKey) {
    activeGear = null;
  } else if (count > 0) {
    activeGear = { slotKey, label, count };
  }
  updateGearIconStates();
  renderDiceTray();
  // Results intentionally NOT cleared here — dice persist until explicit Clear
}

/* -----------------------------------------------
   Icon state sync
   ----------------------------------------------- */
function updateAptitudeIconStates() {
  const selected = aptitudeQueue.map(a => a.apt);
  document.querySelectorAll(".apt-die-icon").forEach(btn => {
    btn.classList.toggle("apt-die-icon--selected", selected.includes(btn.dataset.apt));
  });
}

function updateGearIconStates() {
  document.querySelectorAll(".gear-die-icon").forEach(btn => {
    btn.classList.toggle(
      "gear-die-icon--selected",
      activeGear?.slotKey === btn.dataset.slotKey
    );
  });
}

/* -----------------------------------------------
   Raw counts
   ----------------------------------------------- */
function rawAptCount()  { return aptitudeQueue.reduce((s, a) => s + a.count, 0); }
function rawGearCount() { return activeGear?.count ?? 0; }

/* -----------------------------------------------
   Difficulty-adjusted pool
   Removes aptitude dice first, then gear
   Returns { aptDice, gearDice, total }
   ----------------------------------------------- */
function adjustedPool() {
  const diff  = Math.max(0, parseInt(
    document.getElementById("dice-difficulty")?.value
  ) || 0);

  let aptDice  = rawAptCount();
  let gearDice = rawGearCount();

  const aptRemove  = Math.min(diff, aptDice);
  aptDice         -= aptRemove;
  const gearRemove = Math.min(diff - aptRemove, gearDice);
  gearDice        -= gearRemove;

  return { aptDice, gearDice, total: aptDice + gearDice };
}

/* -----------------------------------------------
   Build breakdown label
   e.g. "2d6 (Finesse) + 3d6 (Exert) + 2d6 (Gear)"
   ----------------------------------------------- */
function buildBreakdownLabel() {
  const { aptDice, gearDice } = adjustedPool();
  const parts = [];

  // Distribute adjusted aptitude dice across selections proportionally
  let aptRemaining = aptDice;
  aptitudeQueue.forEach(({ apt, count }, i) => {
    const isLast    = i === aptitudeQueue.length - 1;
    const allocated = isLast ? aptRemaining : Math.min(count, aptRemaining);
    aptRemaining   -= allocated;
    if (allocated > 0) {
      const label = apt.charAt(0).toUpperCase() + apt.slice(1);
      parts.push(`${allocated}d6 (${label})`);
    }
  });

  if (gearDice > 0 && activeGear) {
    parts.push(`${gearDice}d6 (${activeGear.label})`);
  }

  return parts.join(" + ");
}

/* -----------------------------------------------
   Build notation for Dice+
   ----------------------------------------------- */
function buildNotation() {
  const { total } = adjustedPool();
  return total > 0 ? `${total}d6` : "";
}

/* -----------------------------------------------
   Render the tray
   ----------------------------------------------- */
function renderDiceTray() {
  const tray        = document.getElementById("dice-tray");
  const display     = document.getElementById("dice-pool-display");
  const handleCount = document.getElementById("dice-tray-count");
  const rollBtn     = document.getElementById("dice-roll-btn");
  const clearBtn    = document.getElementById("dice-clear-btn");

  if (!tray || !display || !handleCount || !rollBtn || !clearBtn) return;

  const selectionCount = aptitudeQueue.length + (activeGear ? 1 : 0); // selections, not dice
  const { aptDice, gearDice, total: netTotal } = adjustedPool();

  // Handle badge
  handleCount.textContent = selectionCount > 0 ? (buildBreakdownLabel() || "0d6") : "";

  // Show tray always; open body whenever something is selected (even 0 dice)
  tray.style.display = "block";
  const body = tray.querySelector(".dice-tray__body");
  if (body) {
    body.style.display = selectionCount > 0 ? "flex" : "none";
  }

  rollBtn.disabled  = netTotal === 0;
  clearBtn.disabled = selectionCount === 0;

  // Pool display — individual SVG die icons
  display.innerHTML = "";

  // How many apt dice are removed by difficulty
  const aptRemoved  = rawAptCount() - aptDice;
  const gearRemoved = rawGearCount() - gearDice;

  // Render aptitude dice — red icons, grouped by aptitude
  let aptRemovedLeft = aptRemoved;
  aptitudeQueue.forEach(({ apt, count }) => {
    const label = apt.charAt(0).toUpperCase() + apt.slice(1);
    for (let i = 0; i < count; i++) {
      const removed = aptRemovedLeft > 0;
      if (removed) aptRemovedLeft--;
      display.appendChild(makeDieIcon("apt", label, removed));
    }
  });

  // Render gear dice — yellow icons
  if (activeGear) {
    let gearRemovedLeft = gearRemoved;
    for (let i = 0; i < activeGear.count; i++) {
      const removed = gearRemovedLeft > 0;
      if (removed) gearRemovedLeft--;
      display.appendChild(makeDieIcon("gear", activeGear.label, removed));
    }
  }

  // Breakdown label under pool
  const breakdownEl = document.getElementById("dice-pool-breakdown");
  if (breakdownEl) {
    breakdownEl.textContent = netTotal > 0 ? buildBreakdownLabel() : "";
  }
}

/* -----------------------------------------------
   Create a single die icon element
   ----------------------------------------------- */
function makeDieIcon(type, label, removed) {
  const wrap = document.createElement("div");
  wrap.className = `pool-die pool-die--${type}${removed ? " pool-die--removed" : ""}`;
  wrap.title = label;

  const img = document.createElement("img");
  img.src = DIE_SVG_URL;
  img.alt = label;
  img.className = "pool-die__img";
  wrap.appendChild(img);

  return wrap;
}

/* -----------------------------------------------
   Clear
   ----------------------------------------------- */
function clearDiceTray() {
  aptitudeQueue.length = 0;
  activeGear           = null;
  lastRollResults      = null;
  lastRenderMode       = "none";
  lastPushGroups       = null;
  hasPushed            = false;

  const diffInput = document.getElementById("dice-difficulty");
  if (diffInput) diffInput.value = "";

  const banner = document.getElementById("dice-success-banner");
  if (banner) { banner.style.display = "none"; banner.innerHTML = ""; }

  updateAptitudeIconStates();
  updateGearIconStates();
  renderDiceTray();
  hideDiceResult();
  updatePushState();
}

/* -----------------------------------------------
   Get current success threshold from UI (4, 5, or 6)
   ----------------------------------------------- */
function getThreshold() {
  const active = document.querySelector(".threshold-btn--active");
  return active ? parseInt(active.dataset.threshold) : 5;
}

/* -----------------------------------------------
   Count successes across a flat array of die values
   ----------------------------------------------- */
function countSuccesses(values, threshold) {
  return values.filter(v => v >= threshold).length;
}

/* -----------------------------------------------
   Result display (normal)
   showDiceResult({ apt: [...], gear: [...] })
   Dice persist until Clear is pressed.
   ----------------------------------------------- */
function showDiceResult(results) {
  const el     = document.getElementById("dice-tray-result");
  const banner = document.getElementById("dice-success-banner");
  if (!el) return;

  lastRenderMode = "normal";
  lastPushGroups = null;

  // --- string fallback (error) ---
  if (typeof results === "string") {
    el.innerHTML     = `<span class="result-error">${results}</span>`;
    el.style.display = "flex";
    if (banner) banner.style.display = "none";
    return;
  }

  const threshold  = getThreshold();
  const aptVals    = results.apt  || [];
  const gearVals   = results.gear || [];
  const allValues  = [...aptVals, ...gearVals];
  const successes  = countSuccesses(allValues, threshold);
  const aptOnes    = aptVals.filter(v => v === 1).length;
  const gearOnes   = gearVals.filter(v => v === 1).length;

  // --- Success headline banner ---
  if (banner) {
    banner.innerHTML = "";
    banner.style.display = "flex";
    const isZero = successes === 0;
    banner.className = "dice-tray__success-banner" + (isZero ? " success-banner__zero" : "");

    const headline = document.createElement("span");
    headline.className   = "result-headline";
    headline.textContent = isZero
      ? `✗  No Successes  (need ${threshold}+)`
      : `✔  ${successes} Success${successes !== 1 ? "es" : ""}  on ${threshold}+`;
    banner.appendChild(headline);

    // Ones summary line — only if any 1s rolled
    const totalOnes = aptOnes + gearOnes;
    if (totalOnes > 0) {
      const onesLine = document.createElement("span");
      onesLine.className = "result-ones-summary";
      const parts = [];
      if (aptOnes  > 0) parts.push(`${aptOnes} apt`);
      if (gearOnes > 0) parts.push(`${gearOnes} gear`);
      onesLine.textContent = `⚠ ${totalOnes} one${totalOnes !== 1 ? "s" : ""} (${parts.join(" + ")})`;
      banner.appendChild(onesLine);
    }
  }

  // --- Die pip groups ---
  el.innerHTML     = "";
  el.style.display = "flex";

  function renderGroup(values, groupLabel, pipClass) {
    if (!values || values.length === 0) return;
    const ones = values.filter(v => v === 1).length;

    const group = document.createElement("div");
    group.className = "result-group";

    // Header row: label + ones count
    const header = document.createElement("div");
    header.className = "result-group-header";

    const lbl = document.createElement("span");
    lbl.className   = "result-group-label";
    lbl.textContent = groupLabel;
    header.appendChild(lbl);

    if (ones > 0) {
      const onesTag = document.createElement("span");
      onesTag.className   = "result-group-ones";
      onesTag.textContent = `${ones} × 1`;
      header.appendChild(onesTag);
    }
    group.appendChild(header);

    // Pip row
    const pips = document.createElement("div");
    pips.className = "result-group-pips";
    values.forEach(val => {
      const pip       = document.createElement("span");
      const isSuccess = val >= threshold;
      const isOne     = val === 1;
      pip.className   = [
        "result-pip",
        pipClass,
        isOne     ? "result-pip--one"     : "",
        isSuccess ? "result-pip--success" : "result-pip--fail"
      ].filter(Boolean).join(" ");
      pip.textContent = val;
      pips.appendChild(pip);
    });
    group.appendChild(pips);
    el.appendChild(group);
  }

  renderGroup(aptVals,  "Aptitude Dice", "result-pip--apt");
  renderGroup(gearVals, "Gear Dice",     "result-pip--gear");
}

function hideDiceResult() {
  // Only called on explicit Clear — don't call on toggle or re-roll
  const el = document.getElementById("dice-tray-result");
  if (el) { el.innerHTML = ""; el.style.display = "none"; }
  const banner = document.getElementById("dice-success-banner");
  if (banner) { banner.innerHTML = ""; banner.style.display = "none"; }
}

/* -----------------------------------------------
   Dice+ ready check
   ----------------------------------------------- */
async function checkDicePlusReady() {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const unsub = OBR.broadcast.onMessage("dice-plus/isReady", (event) => {
      if ("ready" in event.data && event.data.requestId === requestId) {
        unsub();
        resolve(true);
      }
    });
    OBR.broadcast.sendMessage(
      "dice-plus/isReady",
      { requestId, timestamp: Date.now() },
      { destination: "ALL" }
    );
    setTimeout(() => { unsub(); resolve(false); }, 1500);
  });
}

/* -----------------------------------------------
   Local roll fallback — used when Dice+ is unavailable
   ----------------------------------------------- */
function rollLocal() {
  const { aptDice, gearDice } = adjustedPool();
  if (aptDice + gearDice <= 0) {
    lastRollResults = null;
    lastRenderMode  = "none";
    lastPushGroups  = null;
    hasPushed       = false;
    updatePushState();
    return;
  }

  const rollDie = () => Math.ceil(Math.random() * 6);
  const aptResults  = Array.from({ length: aptDice  }, rollDie);
  const gearResults = Array.from({ length: gearDice }, rollDie);

  lastRollResults = { apt: aptResults, gear: gearResults };
  lastRenderMode  = "normal";
  lastPushGroups  = null;
  hasPushed       = false;

  showDiceResult(lastRollResults);
  updatePushState();

  const rollBtn = document.getElementById("dice-roll-btn");
  if (rollBtn) {
    rollBtn.disabled    = false;
    rollBtn.textContent = "ROLL ALL";
  }
}

/* -----------------------------------------------
   Roll — tries Dice+ first, falls back to local
   ----------------------------------------------- */
async function triggerRoll() {
  const notation = buildNotation();
  if (!notation) return;

  const rollBtn = document.getElementById("dice-roll-btn");
  if (!rollBtn) return;

  rollBtn.disabled    = true;
  rollBtn.textContent = "Checking…";

  const isReady = await checkDicePlusReady();
  if (!isReady) {
    // Dice+ not available — roll locally instead
    rollBtn.disabled    = false;
    rollBtn.textContent = "ROLL ALL";
    rollLocal();
    return;
  }

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  rollBtn.textContent = "Rolling…";

  // Capture the split counts now before any state changes
  const { aptDice, gearDice } = adjustedPool();

  const resultUnsub = OBR.broadcast.onMessage(
    `${DICE_SOURCE_ID}/roll-result`,
    (event) => {
      const data = event.data;
      if (data.rollId !== rollId) return;
      resultUnsub();
      errorUnsub();

      const flatValues = data.result?.dice?.map(d => d.value)
        ?? data.result?.rolls
        ?? [];

      if (flatValues.length > 0) {
        // Split flat array into apt slice + gear slice
        const splitResults = {
          apt:  flatValues.slice(0, aptDice),
          gear: flatValues.slice(aptDice)
        };
        lastRollResults = splitResults;
        lastRenderMode  = "normal";
        lastPushGroups  = null;
        hasPushed       = false;

        showDiceResult(splitResults);
        updatePushState();
      } else if (data.result?.totalValue !== undefined) {
        // Ignore totalValue — we want individual die results only
        // Fall back to local roll to get proper per-die display
        rollLocal();
        return;
      }

      rollBtn.disabled    = false;
      rollBtn.textContent = "ROLL ALL";
    }
  );

  const errorUnsub = OBR.broadcast.onMessage(
    `${DICE_SOURCE_ID}/roll-error`,
    (event) => {
      const data = event.data;
      if (data.rollId !== rollId) return;
      resultUnsub();
      errorUnsub();
      // Fall back to local on error
      rollBtn.disabled    = false;
      rollBtn.textContent = "ROLL ALL";
      rollLocal();
    }
  );

  try {
    const playerId   = await OBR.player.getId();
    const playerName = await OBR.player.getName();
    await OBR.broadcast.sendMessage(
      "dice-plus/roll-request",
      {
        rollId,
        playerId,
        playerName,
        rollTarget:   "everyone",
        diceNotation: notation,
        showResults:  false,
        timestamp:    Date.now(),
        source:       DICE_SOURCE_ID
      },
      { destination: "ALL" }
    );
  } catch (err) {
    resultUnsub();
    errorUnsub();
    // Fall back to local on broadcast error
    rollBtn.disabled    = false;
    rollBtn.textContent = "ROLL ALL";
    rollLocal();
  }

  // Safety timeout — fall back to local if no response
  setTimeout(() => {
    try { resultUnsub(); } catch {}
    try { errorUnsub();  } catch {}
    if (rollBtn.textContent === "Rolling…") {
      rollBtn.disabled    = false;
      rollBtn.textContent = "ROLL ALL";
      rollLocal();
    }
  }, 15000);
}

/* -----------------------------------------------
   Push — reroll non-1 failures; keep successes and 1s.
   One-shot per roll. Re-rolled dice shown with dashed border.
   ----------------------------------------------- */
function triggerPush() {
  const pushBtn = document.getElementById("dice-push-btn");
  if (!pushBtn) return;

  const hasResults =
    lastRollResults &&
    (Array.isArray(lastRollResults.apt) || Array.isArray(lastRollResults.gear));

  // Guard: need results and must not have pushed already
  if (!hasResults || hasPushed) {
    updatePushState();
    return;
  }

  const threshold = getThreshold();
  const rollDie   = () => Math.ceil(Math.random() * 6);

  // Map each value: keep if success or 1, else reroll
  function pushGroup(values) {
    if (!Array.isArray(values)) return [];
    return values.map(v => {
      const kept = (v >= threshold || v === 1);
      return { val: kept ? v : rollDie(), pushed: !kept };
    });
  }

  const aptVals  = Array.isArray(lastRollResults.apt)  ? lastRollResults.apt  : [];
  const gearVals = Array.isArray(lastRollResults.gear) ? lastRollResults.gear : [];

  const pushedApt  = pushGroup(aptVals);
  const pushedGear = pushGroup(gearVals);

  // Update lastRollResults to the new flat values
  lastRollResults = {
    apt:  pushedApt.map(d => d.val),
    gear: pushedGear.map(d => d.val)
  };

  lastRenderMode = "push";
  lastPushGroups = { apt: pushedApt, gear: pushedGear };
  hasPushed      = true;

  showDiceResultPushed(lastPushGroups);
  updatePushState();
}

/* Show push results — same as showDiceResult but marks re-rolled dice */
function showDiceResultPushed(groups) {
  const el     = document.getElementById("dice-tray-result");
  const banner = document.getElementById("dice-success-banner");
  if (!el) return;

  lastRenderMode = "push";
  lastPushGroups = groups;

  const threshold = getThreshold();
  const allVals   = [...groups.apt, ...groups.gear].map(d => d.val);
  const successes = countSuccesses(allVals, threshold);
  const aptOnes   = groups.apt.filter(d => d.val === 1).length;
  const gearOnes  = groups.gear.filter(d => d.val === 1).length;

  // Banner
  if (banner) {
    banner.innerHTML = "";
    banner.style.display = "flex";
    const isZero = successes === 0;
    banner.className = "dice-tray__success-banner" + (isZero ? " success-banner__zero" : "");

    const headline = document.createElement("span");
    headline.className   = "result-headline";
    headline.textContent = (isZero
      ? `✗  No Successes  (need ${threshold}+)`
      : `✔  ${successes} Success${successes !== 1 ? "es" : ""}  on ${threshold}+`)
      + "  — after Push";
    banner.appendChild(headline);

    const totalOnes = aptOnes + gearOnes;
    if (totalOnes > 0) {
      const onesLine = document.createElement("span");
      onesLine.className = "result-ones-summary";
      const parts = [];
      if (aptOnes  > 0) parts.push(`${aptOnes} apt`);
      if (gearOnes > 0) parts.push(`${gearOnes} gear`);
      onesLine.textContent = `⚠ ${totalOnes} one${totalOnes !== 1 ? "s" : ""} (${parts.join(" + ")})`;
      banner.appendChild(onesLine);
    }
  }

  el.innerHTML     = "";
  el.style.display = "flex";

  function renderPushGroup(dice, groupLabel, pipClass) {
    if (!dice || dice.length === 0) return;
    const ones = dice.filter(d => d.val === 1).length;

    const group = document.createElement("div");
    group.className = "result-group";

    const header = document.createElement("div");
    header.className = "result-group-header";
    const lbl = document.createElement("span");
    lbl.className   = "result-group-label";
    lbl.textContent = groupLabel;
    header.appendChild(lbl);
    if (ones > 0) {
      const onesTag = document.createElement("span");
      onesTag.className   = "result-group-ones";
      onesTag.textContent = `${ones} × 1`;
      header.appendChild(onesTag);
    }
    group.appendChild(header);

    const pips = document.createElement("div");
    pips.className = "result-group-pips";
    dice.forEach(({ val, pushed }) => {
      const pip       = document.createElement("span");
      const isSuccess = val >= threshold;
      const isOne     = val === 1;
      pip.className   = [
        "result-pip",
        pipClass,
        isOne     ? "result-pip--one"     : "",
        isSuccess ? "result-pip--success" : "result-pip--fail",
        pushed    ? "result-pip--pushed"  : "result-pip--kept"
      ].filter(Boolean).join(" ");
      pip.textContent = val;
      if (pushed) pip.title = "re-rolled";
      pips.appendChild(pip);
    });
    group.appendChild(pips);
    el.appendChild(group);
  }

  renderPushGroup(groups.apt,  "Aptitude Dice", "result-pip--apt");
  renderPushGroup(groups.gear, "Gear Dice",     "result-pip--gear");
}

/* -----------------------------------------------
   Re-render last results when threshold/difficulty changes
   ----------------------------------------------- */
function rerenderLastResults() {
  if (!lastRollResults) return;
  if (lastRenderMode === "push" && lastPushGroups) {
    showDiceResultPushed(lastPushGroups);
  } else {
    showDiceResult(lastRollResults);
  }
}

/* -----------------------------------------------
   Wire up aptitude die icons
   ----------------------------------------------- */
document.querySelectorAll(".apt-die-icon").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleAptitude(btn.dataset.apt);
  });
});

/* -----------------------------------------------
   Wire up tray controls
   ----------------------------------------------- */
document.getElementById("dice-roll-btn")
  ?.addEventListener("click", triggerRoll);

document.getElementById("dice-clear-btn")
  ?.addEventListener("click", clearDiceTray);

document.getElementById("dice-push-btn")
  ?.addEventListener("click", triggerPush);

document.getElementById("dice-difficulty")
  ?.addEventListener("input", () => {
    renderDiceTray();
    // Re-run result display to update success count with same dice
    rerenderLastResults();
  });

// Threshold buttons
document.querySelectorAll(".threshold-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".threshold-btn")
      .forEach(b => b.classList.remove("threshold-btn--active"));
    btn.classList.add("threshold-btn--active");
    // Recount successes immediately if results are showing
    rerenderLastResults();
  });
});

// Close button — clears pool and hides tray body (separate from handle toggle)
document.getElementById("dice-tray-close")
  ?.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    clearDiceTray();
  });

// Handle click — collapse/expand body, but NOT when close button was clicked
document.getElementById("dice-tray-handle")
  ?.addEventListener("click", (e) => {
    if (e.target.closest("#dice-tray-close")) return; // close btn handled separately
    const body = document.querySelector(".dice-tray__body");
    if (body) body.style.display = body.style.display === "none" ? "flex" : "none";
  });

/* -----------------------------------------------
   Wire up row die icons (weapon/armor — baked into HTML)
   ----------------------------------------------- */
function wireRowDieIcons() {
  document.querySelectorAll(".gear-die-icon--row").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slotKey    = btn.dataset.slotKey;
      const n          = slotKey.split("-")[1];
      const isWeapon   = slotKey.startsWith("weapon");
      const nameName   = isWeapon ? `attr_weapon_name_${n}` : `attr_armor_name_${n}`;
      const gearName   = isWeapon ? `attr_weapon_gear_a_${n}` : `attr_armor_gear_a_${n}`;
      const nameInput  = document.querySelector(`input[name="${nameName}"]`);
      const gearInput  = document.querySelector(`input[name="${gearName}"]`);
      const rawLabel   = nameInput?.value?.trim();
      const fallback   = isWeapon ? `Weapon ${n}` : `Armor ${n}`;
      const label      = rawLabel || fallback;
      const count      = parseInt(gearInput?.value) || 0;
      toggleGear(slotKey, label, count);
    });
  });
}

/* -----------------------------------------------
   Inject gear die icons into general gear rows only
   Icon sits at the right edge of the name column (after the name)
   ----------------------------------------------- */
function injectGearDieIcons() {
  document.querySelectorAll(".sheet-gear-container .gear-row").forEach((row, i) => {
    const n        = i + 1;
    const slotKey  = `gear-${n}`;
    const label    = `Gear ${n}`;
    const valInput = row.querySelector(`input[name="attr_gear_val_${n}"]`);
    const nameCell = row.querySelector(".col-gear-name");
    if (!nameCell || row.querySelector(".gear-die-icon")) return;

    const btn = document.createElement("button");
    btn.className       = "gear-die-icon gear-die-icon--general";
    btn.dataset.slotKey = slotKey;
    btn.title           = `Add ${label} dice`;

    const img = document.createElement("img");
    img.src       = DIE_SVG_URL;
    img.alt       = "d6";
    img.className = "die-icon-img";
    btn.appendChild(img);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nameInput = row.querySelector(`input[name="attr_gear_name_${n}"]`);
      const rawLabel  = nameInput?.value?.trim();
      const liveLabel = rawLabel || label;     // fallback to "Gear N"
      const count     = parseInt(valInput?.value) || 0;
      toggleGear(slotKey, liveLabel, count);
    });

    // Position at right edge of name cell
    nameCell.style.position = "relative";
    nameCell.style.overflow = "visible";
    btn.style.position = "absolute";
    btn.style.right    = "-18px";
    btn.style.top      = "50%";
    btn.style.transform = "translateY(-50%)";
    nameCell.appendChild(btn);
  });
}

injectGearDieIcons();
wireRowDieIcons();
renderDiceTray();
updatePushState();
