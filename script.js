import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/+esm";

/* ================================================
   CHARACTER MODEL
   ================================================ */
const character = {
  stress: {
    finesse_devise: Array(6).fill(false),
    exert_adapt:    Array(6).fill(false),
    sense_resist:   Array(6).fill(false),
    deceive_relate: Array(6).fill(false)
  },
  trauma: {
    finesse_devise: Array(6).fill(false),
    exert_adapt:    Array(6).fill(false),
    sense_resist:   Array(6).fill(false),
    deceive_relate: Array(6).fill(false)
  },
  pairConditions: {
    finesse_devise: false,
    exert_adapt:    false,
    sense_resist:   false,
    deceive_relate: false
  }
};

/* ================================================
   STORAGE KEY
   ================================================ */
const STORAGE_KEY = "com.firebynightgames.from-ruin/character";

/* ================================================
   PAIR-ENGINE CHECKBOX GUARD
   These are managed by the stress/trauma engine —
   excluded from the general DOM scan.
   ================================================ */
function isPairEngineCheckbox(el) {
  return el.type === "checkbox" && (
    el.classList.contains("stress-box") ||
    el.classList.contains("trauma-box") ||
    el.id === "cond-finesse-devise" ||
    el.id === "cond-exert-adapt"    ||
    el.id === "cond-sense-resist"   ||
    el.id === "cond-deceive-relate"
  );
}

/* ================================================
   SAVE — named + indexed hybrid
   ================================================ */
async function saveSheet() {
  const root   = document.getElementById("character-sheet");
  const named  = {};
  const checks = {};
  const desc   = [];

  // Named inputs & textareas — skip wound and relic fields (handled separately)
  root.querySelectorAll("input[name], textarea[name]").forEach(el => {
    if (isPairEngineCheckbox(el)) return;
    if (el.name.startsWith("attr_wound_")) return;
    if (el.name.startsWith("attr_relic_")) return;
    if (el.type === "checkbox") named[el.name] = el.checked;
    else named[el.name] = el.value;
  });

  // Id-only checkboxes (global conditions)
  root.querySelectorAll("input[type='checkbox'][id]:not([name])").forEach(el => {
    if (isPairEngineCheckbox(el)) return;
    checks[el.id] = el.checked;
  });

  // Contenteditable desc-fields
  root.querySelectorAll(".desc-field[contenteditable]").forEach(el => {
    desc.push(el.innerHTML);
  });

  // Features — no name attribute, save by position
  const features = [];
  root.querySelectorAll(".features-list textarea").forEach(el => features.push(el.value));

  // Drives text — diamond checkboxes already in named scan
  const drives = [];
  root.querySelectorAll(".drives-list textarea").forEach(el => drives.push(el.value));

  // Flaws
  const flaws = [];
  root.querySelectorAll(".flaws-list textarea").forEach(el => flaws.push(el.value));

  // Wounds — structured array, skip fully-empty rows
  const wounds = [];
  root.querySelectorAll(".wound-row").forEach(row => {
    const apt     = row.querySelector("select")?.value                  ?? "";
    const sev     = row.querySelector("input[name*='severity']")?.value ?? "";
    const dsc     = row.querySelector("input[name*='desc']")?.value     ?? "";
    const patched = row.querySelector("input.wound-patch")?.checked      ?? false;
    if (apt || sev || dsc || patched) wounds.push({ apt, sev, dsc, patched });
  });

  // Relics — saved by position, name is unstable (index-based)
  const relics = [];
  root.querySelectorAll(".relic-row textarea").forEach(el => relics.push(el.value));

  // Pair engine state from model, not DOM
  const pairState = {
    stress:         character.stress,
    trauma:         character.trauma,
    pairConditions: character.pairConditions
  };

  const data = { named, checks, desc, features, drives, flaws, relics, wounds, pairState };

  try {
    const playerKey = await getPlayerKey();
    // Read existing metadata first, then merge — matches OBR extension pattern
    const existing = await OBR.room.getMetadata();
    const existingBlock = (existing[STORAGE_KEY] ?? {});
    const merged = { ...existingBlock, [playerKey]: data };
    await OBR.room.setMetadata({ [STORAGE_KEY]: merged });
    // Verify
    const verify = await OBR.room.getMetadata();
    const verifyBlock = verify[STORAGE_KEY];
    if (verifyBlock && verifyBlock[playerKey]) {
      console.log("[FromRuin] Save verified in room metadata ✓");
    } else {
      console.warn("[FromRuin] Save appeared to succeed but read-back found nothing!");
    }
  } catch (err) {
    console.warn("[FromRuin] OBR save failed, falling back to localStorage:", err);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

/* ================================================
   LOAD — named + indexed hybrid
   ================================================ */
async function getPlayerKey() {
  const id = await OBR.player.getId();
  console.log("[FromRuin] Player ID:", id);
  return `${STORAGE_KEY}.${id}`;
}

async function loadSheet() {
  try {
    const playerKey = await getPlayerKey();
    const meta = await OBR.room.getMetadata();
    console.log("[FromRuin] Room metadata keys:", Object.keys(meta));
    const block = meta[STORAGE_KEY];
    if (block && block[playerKey]) {
      console.log("[FromRuin] Loaded from OBR room metadata OK");
      return block[playerKey];
    } else {
      console.log("[FromRuin] No data found in OBR room metadata for this player");
    }
  } catch (err) {
    console.warn("[FromRuin] OBR load failed, falling back to localStorage:", err);
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function restoreSheet(saved) {
  if (!saved) return;
  const root = document.getElementById("character-sheet");

  // 1. Named fields (wound fields excluded — rebuilt in step 7)
  if (saved.named) {
    Object.entries(saved.named).forEach(([name, value]) => {
      const el = root.querySelector(`[name="${name}"]`);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!value;
      else el.value = value ?? "";
    });
  }

  // 2. Id-only checkboxes
  if (saved.checks) {
    Object.entries(saved.checks).forEach(([id, checked]) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.checked = !!checked;
    });
  }

  // 3. Contenteditable desc-fields
  if (saved.desc) {
    root.querySelectorAll(".desc-field[contenteditable]").forEach((el, i) => {
      if (saved.desc[i] !== undefined) el.innerHTML = saved.desc[i];
    });
  }

  // 4. Features
  if (saved.features?.length) {
    const list = root.querySelector(".features-list");
    if (list) {
      saved.features.forEach((text, i) => {
        let li = list.querySelectorAll("li")[i];
        if (!li) {
          li = document.createElement("li");
          li.innerHTML = '<textarea placeholder="Add a feature..." rows="1"></textarea>';
          list.appendChild(li);
        }
        const ta = li.querySelector("textarea");
        if (ta) { ta.value = text; ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
      });
    }
  }

  // 5. Drives text
  if (saved.drives?.length) {
    const list = root.querySelector(".drives-list");
    if (list) {
      saved.drives.forEach((text, i) => {
        let li = list.querySelectorAll("li")[i];
        if (!li && i < 3) {
          li = document.createElement("li");
          li.innerHTML = `
            <div class="drive-item">
              <textarea placeholder="Add a drive..." rows="1" name="attr_drive_${i + 1}"></textarea>
              <div class="drive-tracker">
                <input type="checkbox" name="attr_drive_${i + 1}_cb_1" class="diamond-box db-1">
                <input type="checkbox" name="attr_drive_${i + 1}_cb_2" class="diamond-box db-2">
                <input type="checkbox" name="attr_drive_${i + 1}_cb_3" class="diamond-box db-3">
              </div>
            </div>`;
          list.appendChild(li);
        }
        const ta = li?.querySelector("textarea");
        if (ta) { ta.value = text; ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
      });
    }
  }

  // 6. Flaws
  if (saved.flaws?.length) {
    const list = root.querySelector(".flaws-list");
    if (list) {
      saved.flaws.forEach((text, i) => {
        let li = list.querySelectorAll("li")[i];
        if (!li && i < 3) {
          li = document.createElement("li");
          li.innerHTML = `<textarea placeholder="Add a flaw..." rows="1" name="attr_flaw_${i + 1}"></textarea>`;
          list.appendChild(li);
        }
        const ta = li?.querySelector("textarea");
        if (ta) { ta.value = text; ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
      });
    }
  }

  // 7. Relics
  if (saved.relics?.length) {
    const rows = root.querySelectorAll(".relic-row");
    saved.relics.forEach((text, i) => {
      let row = rows[i];
      if (!row) {
        addRelicRow();
        row = relicContainer.querySelectorAll(".relic-row")[i];
      }
      const ta = row?.querySelector("textarea");
      if (ta) {
        ta.value = text;
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      }
    });
  }

  // 9. Wounds
  if (saved.wounds?.length) {
    const container = root.querySelector("#wounds-container");
    if (container) {
      container.querySelectorAll(".wound-row").forEach(r => r.remove());
      saved.wounds.forEach((w, i) => {
        const row = createWoundRow(i + 1);
        container.appendChild(row);
        row.querySelector("select").value = w.apt ?? "";
        const sev = row.querySelector("input[name*='severity']");
        const dsc = row.querySelector("input[name*='desc']");
        const pat = row.querySelector("input.wound-patch");
        if (sev) sev.value   = w.sev     ?? "";
        if (dsc) dsc.value   = w.dsc     ?? "";
        if (pat) pat.checked = !!w.patched;
      });
      container.appendChild(createWoundRow(saved.wounds.length + 1));
    }
  }

  // 10. Pair state — aptitudes are in DOM so caps calculate correctly
  restorePairState(saved.pairState);

  // 11. Re-sync derived UI
  syncSummary();
  calculateTotalBulk();
}

/* ================================================
   RESTORE PAIR STATE
   ================================================ */
function restorePairState(pairState) {
  if (!pairState) {
    updateAllPairs();
    return;
  }
  const { stress, trauma, pairConditions } = pairState;

  // Restore pair conditions first (they affect stress caps)
  Object.entries(pairConditions).forEach(([key, checked]) => {
    const el = document.getElementById(`cond-${key.replace("_", "-")}`);
    if (el) el.checked = !!checked;
    character.pairConditions[key] = !!checked;
  });

  // Set caps based on current aptitude values — caps only, don't wipe checked state
  applyCapsOnly();

  // Restore stress — write checked state directly based on cap, ignoring
  // disabled state. Condition disabling is cosmetic and applied afterwards.
  Object.entries(stress).forEach(([key, arr]) => {
    const prefix = Object.keys(PAIR_MAP).find(p => PAIR_MAP[p].key === key);
    if (!prefix) return;
    const { apt1, apt2 } = PAIR_MAP[prefix];
    const val1 = parseInt(document.querySelector(`input[name="attr_${apt1}"]`)?.value) || 0;
    const val2 = parseInt(document.querySelector(`input[name="attr_${apt2}"]`)?.value) || 0;
    const stressCap = Math.min(val1, val2);
    document.querySelectorAll(`.stress-box.${prefix}`).forEach((box, i) => {
      box.checked = i < stressCap ? !!arr[i] : false;
      character.stress[key][i] = box.checked;
    });
  });

  // Restore trauma
  Object.entries(trauma).forEach(([key, arr]) => {
    const prefix = Object.keys(PAIR_MAP).find(p => PAIR_MAP[p].key === key);
    if (!prefix) return;
    const { apt1, apt2 } = PAIR_MAP[prefix];
    const val1 = parseInt(document.querySelector(`input[name="attr_${apt1}"]`)?.value) || 0;
    const val2 = parseInt(document.querySelector(`input[name="attr_${apt2}"]`)?.value) || 0;
    const traumaCap = Math.max(val1, val2);
    document.querySelectorAll(`.trauma-box.${prefix}`).forEach((box, i) => {
      box.checked = i < traumaCap ? !!arr[i] : false;
      character.trauma[key][i] = box.checked;
    });
  });

  // Apply disabled/opacity on top of the restored checked state
  updateAllPairs();

  updateCurrentAptitudes();
}

/* ================================================
   TABS ROUTING
   ================================================ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (evt) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active-tab'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(btn.dataset.tab).classList.add('active-tab');
    evt.currentTarget.classList.add('active');

    const isGearTab = btn.dataset.tab === 'tab-2';
    const sheet = document.getElementById('character-sheet');
    if (isGearTab) {
      sheet.classList.add('gear-active');
    } else {
      sheet.classList.remove('gear-active');
    }

    document.getElementById('xp-header').style.display    = isGearTab ? 'none'  : 'block';
    document.getElementById('xp-body').style.display      = isGearTab ? 'none'  : 'flex';
    document.getElementById('bulk-header').style.display  = isGearTab ? 'block' : 'none';
    document.getElementById('bulk-body').style.display    = isGearTab ? 'flex'  : 'none';
    document.getElementById('bulk-penalty').style.display = isGearTab ? 'block' : 'none';
  });
});

/* ================================================
   BULK CALCULATION
   ================================================ */
function calculateTotalBulk() {
  let total = 0;
  document.querySelectorAll('input[name*="_bulk"]').forEach(input => {
    const val = parseFloat(input.value);
    if (!isNaN(val)) total += val;
  });

  let threshold = 20;
  if (total > 20) threshold = Math.ceil((total - 20) / 5) * 5 + 20;

  const penalty = total <= 20 ? 0 : Math.ceil((total - 20) / 5);
  const maxed   = penalty >= 6;

  const totalEl     = document.getElementById('bulk-total');
  const thresholdEl = document.getElementById('bulk-threshold');
  const penaltyEl   = document.getElementById('bulk-penalty');

  if (totalEl)     { totalEl.textContent     = total;     totalEl.style.color     = maxed ? 'red' : '#000'; }
  if (thresholdEl) { thresholdEl.textContent = threshold; thresholdEl.style.color = maxed ? 'red' : '#000'; }
  if (penaltyEl) {
    penaltyEl.textContent = penalty <= 0 ? '' : maxed ? '+6 Difficulty (Max)' : `+${penalty} Difficulty`;
  }
}

document.getElementById('character-sheet').addEventListener('input', (e) => {
  if (e.target.name?.includes('_bulk')) calculateTotalBulk();
});
calculateTotalBulk();

/* ================================================
   ACCORDION TOGGLES
   ================================================ */
document.querySelectorAll('.acc-header').forEach(button => {
  button.addEventListener('click', () => {
    button.nextElementSibling.classList.toggle('open');
  });
});

/* ================================================
   WEAPON BLOCK GENERATOR
   ================================================ */
const weaponContainer = document.getElementById('weapons-container');
if (weaponContainer) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `
      <div class="weapon-block slot-${i}">
        <div class="weapon-row">
          <div class="field-wrap col-name">
            <input type="text" name="attr_weapon_name_${i}" placeholder="-">
          </div>
          <div class="field-wrap col-gear">
            <div class="gear-double-input">
              <input type="number" class="single-digit" name="attr_weapon_gear_a_${i}" placeholder="-">
              <input type="number" class="single-digit" name="attr_weapon_gear_b_${i}" placeholder="-">
            </div>
          </div>
          <div class="field-wrap col-hand">
            <input type="number" name="attr_weapon_hand_${i}" placeholder="-">
          </div>
          <div class="field-wrap col-size">
            <input type="number" name="attr_weapon_size_${i}" placeholder="-">
          </div>
          <div class="field-wrap col-damage">
            <input type="number" name="attr_weapon_damage_${i}" placeholder="-">
          </div>
          <div class="field-wrap col-bulk">
            <input type="number" name="attr_weapon_bulk_${i}" placeholder="-">
          </div>
        </div>
        <div class="weapon-features-row">
          <label>Features:</label>
          <input type="text" name="attr_weapon_features_${i}" placeholder="...">
        </div>
      </div>`;
  }
  weaponContainer.innerHTML = html;
}

/* ================================================
   ARMOR BLOCK GENERATOR
   ================================================ */
const armorContainer = document.getElementById('armor-container');
if (armorContainer) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `
      <div class="armor-block armor-slot-${i}">
        <div class="armor-row">
          <div class="field-wrap col-armor-name">
            <input type="text" name="attr_armor_name_${i}" placeholder="-">
          </div>
          <div class="field-wrap col-armor-gear">
            <div class="gear-double-input">
              <input type="number" class="single-digit" name="attr_armor_gear_a_${i}" placeholder="-">
              <input type="number" class="single-digit" name="attr_armor_gear_b_${i}" placeholder="-">
            </div>
          </div>
          <div class="field-wrap col-armor-features">
            <input type="text" name="attr_armor_features_${i}" placeholder="...">
          </div>
          <div class="field-wrap col-armor-bulk">
            <input type="number" name="attr_armor_bulk_${i}" placeholder="-">
          </div>
        </div>
      </div>`;
  }
  armorContainer.innerHTML = html;
}

/* ================================================
   SPELLS LIST GENERATOR & AUTO-GROW
   ================================================ */
const spellsContainer = document.getElementById('spells-container');

function createSpellRowHTML(index) {
  return `
    <li class="spell-item-node">
      <div class="spell-item-grid">
        <textarea name="attr_spell_desc_${index}" placeholder="Add a spell or ritual..." rows="1"></textarea>
        <input type="number" name="attr_spell_difficulty_${index}" placeholder="-">
      </div>
    </li>`;
}

if (spellsContainer) {
  let html = '';
  for (let i = 1; i <= 10; i++) html += createSpellRowHTML(i);
  spellsContainer.innerHTML = html;

  spellsContainer.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const all  = spellsContainer.querySelectorAll('.spell-item-grid textarea');
    const last = all[all.length - 1];
    if (e.target === last && last.value.trim() !== '') {
      const div = document.createElement('div');
      div.innerHTML = createSpellRowHTML(all.length + 1);
      spellsContainer.appendChild(div.firstElementChild);
    }
  });
}

/* ================================================
   WOUNDS GENERATOR
   ================================================ */
const APTITUDES = ['Finesse','Devise','Exert','Adapt','Sense','Resist','Deceive','Relate'];

function createWoundRow(index) {
  const row = document.createElement('div');
  row.className = 'wound-row';
  row.innerHTML = `
    <select name="attr_wound_apt_${index}">
      <option value="">Select</option>
      ${APTITUDES.map(a => `<option value="${a.toLowerCase()}">${a}</option>`).join('')}
    </select>
    <input type="text" name="attr_wound_severity_${index}" placeholder="Severity">
    <input type="text" name="attr_wound_desc_${index}"     placeholder="Description">
    <input type="checkbox" class="wound-patch" name="attr_wound_patch_${index}" style="justify-self:end;">`;
  return row;
}

const woundsContainer = document.getElementById('wounds-container');
if (woundsContainer) {
  const headers = document.createElement('div');
  headers.className = 'wounds-column-headers';
  headers.innerHTML = `
    <span>Aptitude</span>
    <span>Severity</span>
    <span>Description</span>
    <span style="text-align:right;">Patched</span>`;
  woundsContainer.appendChild(headers);
  woundsContainer.appendChild(createWoundRow(1));

  woundsContainer.addEventListener('input', (e) => {
    if (!e.target.matches('input[type="text"]')) return;
    const rows    = woundsContainer.querySelectorAll('.wound-row');
    const lastRow = rows[rows.length - 1];
    if (e.target.closest('.wound-row') === lastRow && e.target.value.trim() !== '') {
      woundsContainer.appendChild(createWoundRow(rows.length + 1));
    }
  });
}

/* ================================================
   RELIC GENERATOR
   ================================================ */
const relicContainer = document.getElementById('relics-container');

let relicCount = 0;

function addRelicRow() {
  relicCount++;
  const row = document.createElement('div');
  row.className = 'relic-row';
  row.innerHTML = `<textarea name="attr_relic_${relicCount}" rows="1" placeholder="Name, Type, Effect..."></textarea>`;
  if (relicContainer) relicContainer.appendChild(row);
}

if (relicContainer) {
  for (let i = 0; i < 3; i++) addRelicRow();
  relicContainer.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    const rows    = relicContainer.querySelectorAll('.relic-row');
    const lastRow = rows[rows.length - 1];
    if (e.target.closest('.relic-row') === lastRow && e.target.value.trim() !== '') addRelicRow();
  });
}

/* ================================================
   FEATURES LIST — AUTO GROW + ADD NEW ITEM
   ================================================ */
const featuresList = document.querySelector('.features-list');
if (featuresList) {
  featuresList.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = featuresList.querySelectorAll('textarea');
    const last  = items[items.length - 1];
    if (e.target === last && last.value.trim() !== '') {
      const li = document.createElement('li');
      li.innerHTML = '<textarea placeholder="Add a feature..." rows="1"></textarea>';
      featuresList.appendChild(li);
    }
  });
}

/* ================================================
   DRIVES LIST — AUTO GROW & SLOTS (MAX 3)
   ================================================ */
const drivesList = document.querySelector('.drives-list');
if (drivesList) {
  drivesList.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = drivesList.querySelectorAll('textarea');
    const last  = items[items.length - 1];
    if (e.target === last && last.value.trim() !== '' && items.length < 3) {
      const idx = items.length + 1;
      const li  = document.createElement('li');
      li.innerHTML = `
        <div class="drive-item">
          <textarea placeholder="Add a drive..." rows="1" name="attr_drive_${idx}"></textarea>
          <div class="drive-tracker">
            <input type="checkbox" name="attr_drive_${idx}_cb_1" class="diamond-box db-1">
            <input type="checkbox" name="attr_drive_${idx}_cb_2" class="diamond-box db-2">
            <input type="checkbox" name="attr_drive_${idx}_cb_3" class="diamond-box db-3">
          </div>
        </div>`;
      drivesList.appendChild(li);
    }
  });
}

/* ================================================
   GEAR LIST — AUTO-EXPAND ROWS
   ================================================ */
const gearTable = document.querySelector('.sheet-gear-table');
if (gearTable) {
  gearTable.addEventListener('input', (e) => {
    if (!e.target.matches('.gear-row .col-gear-name input')) return;
    const container = gearTable.querySelector('.sheet-gear-container');
    const allInputs = container.querySelectorAll('.gear-row .col-gear-name input');
    const last      = allInputs[allInputs.length - 1];
    if (e.target === last && last.value.trim() !== '') {
      const idx    = allInputs.length + 1;
      const newRow = document.createElement('div');
      newRow.className = 'gear-row';
      newRow.innerHTML = `
        <div class="field-wrap col-gear-name">
          <input type="text" name="attr_gear_name_${idx}" placeholder="-">
        </div>
        <div class="field-wrap col-gear-bulk">
          <input type="number" name="attr_gear_bulk_${idx}" placeholder="-">
        </div>`;
      container.appendChild(newRow);
    }
  });
}

/* ================================================
   FLAWS LIST — AUTO GROW & SLOTS (MAX 3)
   ================================================ */
const flawsList = document.querySelector('.flaws-list');
if (flawsList) {
  flawsList.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = flawsList.querySelectorAll('textarea');
    const last  = items[items.length - 1];
    if (e.target === last && last.value.trim() !== '' && items.length < 3) {
      const idx = items.length + 1;
      const li  = document.createElement('li');
      li.innerHTML = `<textarea placeholder="Add a flaw..." rows="1" name="attr_flaw_${idx}"></textarea>`;
      flawsList.appendChild(li);
    }
  });
}

/* ================================================
   PORTRAIT UPLOAD
   ================================================ */
const portraitUpload = document.getElementById('portrait-upload');
const portraitImg    = document.getElementById('portrait-img');
const portraitLabel  = document.querySelector('.portrait-upload-label');

if (portraitUpload) {
  portraitUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      portraitImg.src          = ev.target.result;
      portraitImg.style.display = 'block';
      portraitLabel.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}

/* ================================================
   SUMMARY PANEL SYNC
   ================================================ */
const summaryMap = {
  'sum-name':       'NAME',
  'sum-age':        'AGE',
  'sum-people':     'PEOPLE',
  'sum-origin':     'ORIGIN',
  'sum-background': 'BACKGROUND',
  'sum-flaw':       'FLAW',
  'sum-momento':    'MOMENTO',
  'sum-event':      'EVENT'
};

function syncSummary() {
  document.querySelectorAll('.desc-field').forEach(field => {
    const placeholder = field.dataset.placeholder;
    const id = Object.keys(summaryMap).find(k => summaryMap[k] === placeholder);
    if (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = field.textContent.trim();
    }
  });
}

document.querySelector('.desc-panel')?.addEventListener('input', syncSummary);
syncSummary();

/* ================================================
   STORY FIELDS — AUTO GROW
   ================================================ */
document.querySelectorAll('.story-field').forEach(field => {
  field.addEventListener('input', () => {
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
  });
});

/* ================================================
   PAIR-BASED STRESS / TRAUMA ENGINE
   ================================================ */
const PAIR_MAP = {
  fd: { key: "finesse_devise", apt1: "finesse", apt2: "devise" },
  ea: { key: "exert_adapt",    apt1: "exert",   apt2: "adapt"  },
  sr: { key: "sense_resist",   apt1: "sense",   apt2: "resist" },
  dr: { key: "deceive_relate", apt1: "deceive", apt2: "relate" }
};

function updateCurrentAptitudes() {
  Object.values(PAIR_MAP).forEach(({ key, apt1, apt2 }) => {
    const traumaCount = character.trauma[key].filter(v => v).length;
    [apt1, apt2].forEach(apt => {
      const base    = parseInt(document.querySelector(`input[name="attr_${apt}"]`)?.value) || 0;
      const current = Math.max(0, base - traumaCount);
      const el      = document.getElementById(`cur-${apt}`);
      if (el) {
        if (traumaCount > 0 && base > 0) {
          el.textContent = current;
          el.style.color = current === 0 ? "red" : "rgba(255,0,0,0.7)";
        } else {
          el.textContent = "";
        }
      }
    });
  });
}

function updateStressTrauma(prefix) {
  const { key, apt1, apt2 } = PAIR_MAP[prefix];

  const val1 = parseInt(document.querySelector(`input[name="attr_${apt1}"]`)?.value) || 0;
  const val2 = parseInt(document.querySelector(`input[name="attr_${apt2}"]`)?.value) || 0;

  const stressCap       = Math.min(val1, val2);
  const traumaCap       = Math.max(val1, val2);
  const condBox         = document.getElementById(`cond-${key.replace("_", "-")}`);
  const conditionActive = condBox?.checked ?? false;

  document.querySelectorAll(`.stress-box.${prefix}`).forEach((box, i) => {
    const allowed      = i < stressCap;
    box.disabled       = !allowed || conditionActive;
    box.style.opacity  = conditionActive ? "0.5" : "1";
    if (!allowed) box.checked = false;
    character.stress[key][i] = box.checked;
  });

  document.querySelectorAll(`.trauma-box.${prefix}`).forEach((box, i) => {
    const allowed = i < traumaCap;
    box.disabled  = !allowed;
    if (!allowed) box.checked = false;
    character.trauma[key][i] = box.checked;
  });

  character.pairConditions[key] = conditionActive;
  updateCurrentAptitudes();
}

function updateAllPairs() {
  Object.keys(PAIR_MAP).forEach(prefix => updateStressTrauma(prefix));
}

// Like updateAllPairs but ONLY sets disabled/opacity — never touches checked
// state or the character model. Safe to call during restore.
function applyCapsOnly() {
  Object.keys(PAIR_MAP).forEach(prefix => {
    const { key, apt1, apt2 } = PAIR_MAP[prefix];
    const val1 = parseInt(document.querySelector(`input[name="attr_${apt1}"]`)?.value) || 0;
    const val2 = parseInt(document.querySelector(`input[name="attr_${apt2}"]`)?.value) || 0;
    const stressCap       = Math.min(val1, val2);
    const traumaCap       = Math.max(val1, val2);
    const condBox         = document.getElementById(`cond-${key.replace("_", "-")}`);
    const conditionActive = condBox?.checked ?? false;

    document.querySelectorAll(`.stress-box.${prefix}`).forEach((box, i) => {
      const allowed     = i < stressCap;
      box.disabled      = !allowed || conditionActive;
      box.style.opacity = conditionActive ? "0.5" : "1";
      if (!allowed) box.checked = false;
    });

    document.querySelectorAll(`.trauma-box.${prefix}`).forEach((box, i) => {
      const allowed = i < traumaCap;
      box.disabled  = !allowed;
      if (!allowed) box.checked = false;
    });
  });
}

// Aptitude input listeners
Object.values(PAIR_MAP).forEach(({ apt1, apt2 }) => {
  [apt1, apt2].forEach(apt => {
    document.querySelector(`input[name="attr_${apt}"]`)
      ?.addEventListener("input", updateAllPairs);
  });
});

// Pair condition listeners
Object.values(PAIR_MAP).forEach(({ key }) => {
  document.getElementById(`cond-${key.replace("_", "-")}`)
    ?.addEventListener("change", updateAllPairs);
});

// Stress + trauma box listeners
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("stress-box") ||
      e.target.classList.contains("trauma-box")) {
    const prefix = [...e.target.classList].find(c => ["fd","ea","sr","dr"].includes(c));
    if (prefix) updateStressTrauma(prefix);
  }
});

/* ================================================
   INIT
   ================================================ */
OBR.onReady(async () => {

  // Clean up old localStorage versions
  localStorage.removeItem("fromRuinCharacter_v1");
  localStorage.removeItem("fromRuinCharacter_v2");
  localStorage.removeItem("fromRuinCharacter_v3");
  localStorage.removeItem("fromRuinCharacter_v4");
  localStorage.removeItem("fromRuinCharacter_v5");
  localStorage.removeItem("fromRuinCharacter_v6");
  localStorage.removeItem("fromRuinCharacter_v7");
  localStorage.removeItem("fromRuinCharacter_v8");
  localStorage.removeItem("fromRuinCharacter_v9");
  localStorage.removeItem("fromRuinCharacter_v10");
  localStorage.removeItem("fromRuinCharacter_v11");
  localStorage.removeItem("fromRuinCharacter_v12");
  localStorage.removeItem("fromRuinCharacter_v13");
  localStorage.removeItem("fromRuinCharacter_v6");

  const saved = await loadSheet();
  if (saved) {
    restoreSheet(saved);
  } else {
    updateAllPairs();
  }

  // Autosave — delegate to sheet so dynamic rows are always covered
  document.getElementById("character-sheet").addEventListener("input",  saveSheet);
  document.getElementById("character-sheet").addEventListener("change", saveSheet);
  document.querySelectorAll(".desc-field[contenteditable]").forEach(el => {
    el.addEventListener("input", saveSheet);
    el.addEventListener("blur",  saveSheet);
  });
});
