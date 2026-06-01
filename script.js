import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/+esm";

/* ================================================
   CONSTANTS (hoisted — used by generators and dice tray)
   ================================================ */
const DICE_SOURCE_ID  = "com.firebynightgames.from-ruin";
const DIE_SVG_URL     = "https://raw.githubusercontent.com/firebynightgames/From-Ruin-Character/main/dice-six-faces-six.svg";

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

  // Always keep a localStorage backup so hard reloads survive
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  try {
    const playerKey = await getPlayerKey();
    // Read existing metadata first, then merge per-player
    const existing = await OBR.room.getMetadata();
    const existingBlock = (existing[STORAGE_KEY] != null && typeof existing[STORAGE_KEY] === "object")
      ? existing[STORAGE_KEY]
      : {};
    const merged = { ...existingBlock, [playerKey]: data };
    await OBR.room.setMetadata({ [STORAGE_KEY]: merged });
  } catch (err) {
    // OBR unavailable — localStorage backup already written above
  }
}

/* ================================================
   LOAD — named + indexed hybrid
   ================================================ */
async function getPlayerKey() {
  const id = await OBR.player.getId();
  return id;   // just the player ID — used as sub-key inside STORAGE_KEY block
}

async function loadSheet() {
  // Try OBR cloud storage first
  try {
    const playerKey = await getPlayerKey();
    const meta = await OBR.room.getMetadata();
    const block = meta[STORAGE_KEY];
    if (block && typeof block === "object" && block[playerKey]) {
      // Found cloud data — also refresh localStorage backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(block[playerKey]));
      return block[playerKey];
    }
  } catch (err) {
    // OBR unavailable — fall through to localStorage
  }
  // Fallback: localStorage (survives hard reloads when OBR context is briefly lost)
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
          <button class="gear-die-icon gear-die-icon--row col-die" data-slot-key="weapon-${i}" title="Add Weapon ${i} gear dice">
            <img src="${DIE_SVG_URL}" alt="d6" class="die-icon-img">
          </button>
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
          <button class="gear-die-icon gear-die-icon--row col-die" data-slot-key="armor-${i}" title="Add Armor ${i} gear dice">
            <img src="${DIE_SVG_URL}" alt="d6" class="die-icon-img">
          </button>
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
        <div class="field-wrap col-gear-val">
          <input type="number" name="attr_gear_val_${idx}" placeholder="-">
        </div>
        <div class="field-wrap col-gear-bulk">
          <input type="number" name="attr_gear_bulk_${idx}" placeholder="-">
        </div>`;
      container.appendChild(newRow);
      injectGearDieIcons(); // add die icon to the new row
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
        if (base > 0) {
          el.textContent = current;
          el.style.color = traumaCount > 0
            ? (current === 0 ? "red" : "rgba(255,0,0,0.7)")
            : "#555";
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

// Stress + trauma box listeners — also enforce sequential filling and cap
document.addEventListener("change", (e) => {
  const isStress = e.target.classList.contains("stress-box");
  const isTrauma = e.target.classList.contains("trauma-box");
  if (!isStress && !isTrauma) return;

  const prefix = [...e.target.classList].find(c => ["fd","ea","sr","dr"].includes(c));
  if (!prefix) return;

  // Enforce sequential: when checking a box, all prior boxes must be checked;
  // when unchecking, all subsequent boxes must be unchecked.
  const boxClass  = isStress ? "stress-box" : "trauma-box";
  const boxes     = [...document.querySelectorAll(`.${boxClass}.${prefix}`)];
  const idx       = parseInt(e.target.dataset.index);

  if (e.target.checked) {
    // Check all boxes before this one too
    boxes.forEach((b, i) => { if (i < idx && !b.disabled) b.checked = true; });
  } else {
    // If this is a stress box and condition is active, prevent unchecking (locked)
    if (isStress) {
      const condKey  = PAIR_MAP[prefix].key;
      const condId   = `cond-${condKey.replace("_", "-")}`;
      const condBox  = document.getElementById(condId);
      if (condBox?.checked) {
        e.target.checked = true; // revert — stress is locked by condition
        return;
      }
    }
    // Uncheck all boxes after this one too
    boxes.forEach((b, i) => { if (i > idx) b.checked = false; });
  }

  updateStressTrauma(prefix);
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

// Last roll results for Push (future)
let lastRollResults = null;

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
  hideDiceResult();
}

/* -----------------------------------------------
   Toggle gear — max 1, bumps previous (option A)
   ----------------------------------------------- */
function toggleGear(slotKey, label, count) {
  if (activeGear?.slotKey === slotKey) {
    // Deselect
    activeGear = null;
  } else {
    // Replace previous (or set first)
    if (count > 0) activeGear = { slotKey, label, count };
  }
  updateGearIconStates();
  renderDiceTray();
  hideDiceResult();
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
    btn.classList.toggle("gear-die-icon--selected",
      activeGear?.slotKey === btn.dataset.slotKey);
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
  const diff     = Math.max(0, parseInt(
    document.getElementById("dice-difficulty")?.value) || 0);
  let aptDice    = rawAptCount();
  let gearDice   = rawGearCount();

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

  const rawTotal         = rawAptCount() + rawGearCount();
  const selectionCount   = aptitudeQueue.length + (activeGear ? 1 : 0); // selections, not dice
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
  const diffInput = document.getElementById("dice-difficulty");
  if (diffInput) diffInput.value = "";
  document.getElementById("dice-push-btn").disabled = true;
  const banner = document.getElementById("dice-success-banner");
  if (banner) { banner.style.display = "none"; banner.innerHTML = ""; }
  updateAptitudeIconStates();
  updateGearIconStates();
  renderDiceTray();
  hideDiceResult();
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
   Result display — individual die results + success banner
   showDiceResult({ apt: [...], gear: [...] })
   or showDiceResult("error string")
   ----------------------------------------------- */
function showDiceResult(results) {
  const el     = document.getElementById("dice-tray-result");
  const banner = document.getElementById("dice-success-banner");
  if (!el) return;
  el.innerHTML = "";
  el.style.display = "flex";

  if (typeof results === "string") {
    el.textContent = results;
    if (banner) banner.style.display = "none";
    return;
  }

  const threshold = getThreshold();
  const allValues = [...(results.apt || []), ...(results.gear || [])];
  const successes = countSuccesses(allValues, threshold);

  // Success banner
  if (banner) {
    banner.innerHTML = "";
    banner.style.display = "flex";
    banner.className = "dice-tray__success-banner" + (successes === 0 ? " success-banner__zero" : "");
    const label = document.createElement("span");
    label.textContent = successes === 0
      ? `No successes (${threshold}+ to hit)`
      : `${successes} Success${successes !== 1 ? "es" : ""} on ${threshold}+`;
    banner.appendChild(label);
  }

  // Die pip groups
  function renderGroup(values, groupLabel, pipClass) {
    if (!values || values.length === 0) return;
    const group = document.createElement("div");
    group.className = "result-group";

    const lbl = document.createElement("span");
    lbl.className   = "result-group-label";
    lbl.textContent = groupLabel;
    group.appendChild(lbl);

    const pips = document.createElement("div");
    pips.className = "result-group-pips";
    values.forEach(val => {
      const pip = document.createElement("span");
      const isSuccess = val >= threshold;
      const isOne     = val === 1;
      pip.className = `result-pip ${pipClass}${isSuccess ? " result-pip--success" : ""}${isOne ? " result-pip--one" : ""}`;
      pip.textContent = val;
      pips.appendChild(pip);
    });
    group.appendChild(pips);
    el.appendChild(group);
  }

  renderGroup(results.apt,  "Aptitude", "result-pip--apt");
  renderGroup(results.gear, "Gear",     "result-pip--gear");
}

function hideDiceResult() {
  const el = document.getElementById("dice-tray-result");
  if (el) { el.innerHTML = ""; el.style.display = "none"; }
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
  if (aptDice + gearDice <= 0) return;

  const rollDie = () => Math.ceil(Math.random() * 6);
  const aptResults  = Array.from({ length: aptDice  }, rollDie);
  const gearResults = Array.from({ length: gearDice }, rollDie);

  lastRollResults = { apt: aptResults, gear: gearResults };
  showDiceResult(lastRollResults);

  const rollBtn  = document.getElementById("dice-roll-btn");
  const pushBtn  = document.getElementById("dice-push-btn");
  rollBtn.disabled    = false;
  rollBtn.textContent = "ROLL ALL";
  pushBtn.disabled    = false;
}

/* -----------------------------------------------
   Roll — tries Dice+ first, falls back to local
   ----------------------------------------------- */
async function triggerRoll() {
  const notation = buildNotation();
  if (!notation) return;

  const rollBtn = document.getElementById("dice-roll-btn");
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

  // Capture the split counts now before clearDiceTray wipes state
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
        showDiceResult(splitResults);
      } else if (data.result?.totalValue !== undefined) {
        showDiceResult(`Total: ${data.result.totalValue}`);
      }

      rollBtn.disabled    = false;
      rollBtn.textContent = "ROLL ALL";
      document.getElementById("dice-push-btn").disabled = false;
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
   Push — reroll non-1 failures, keep 1s and successes
   ----------------------------------------------- */
function triggerPush() {
  if (!lastRollResults) return;
  const threshold = getThreshold();
  const rollDie   = () => Math.ceil(Math.random() * 6);

  function pushGroup(values) {
    return values.map(v => {
      // Keep: successes (>= threshold) and 1s (can't push past a complication)
      if (v >= threshold || v === 1) return v;
      return rollDie();
    });
  }

  const pushed = {
    apt:  pushGroup(lastRollResults.apt  || []),
    gear: pushGroup(lastRollResults.gear || [])
  };

  lastRollResults = pushed;
  showDiceResult(pushed);

  // Push is one-shot — disable after use
  document.getElementById("dice-push-btn").disabled = true;
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
  .addEventListener("click", triggerRoll);
document.getElementById("dice-clear-btn")
  .addEventListener("click", clearDiceTray);
document.getElementById("dice-push-btn")
  .addEventListener("click", triggerPush);
document.getElementById("dice-difficulty")
  .addEventListener("input", () => {
    renderDiceTray();
    // Re-run showDiceResult to update success count with same dice
    if (lastRollResults) showDiceResult(lastRollResults);
  });

// Threshold buttons
document.querySelectorAll(".threshold-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".threshold-btn").forEach(b => b.classList.remove("threshold-btn--active"));
    btn.classList.add("threshold-btn--active");
    // Recount successes immediately if results are showing
    if (lastRollResults) showDiceResult(lastRollResults);
  });
});

// Close button — clears pool and hides tray body (separate from handle toggle)
document.getElementById("dice-tray-close")
  .addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    clearDiceTray();
  });

// Handle click — collapse/expand body, but NOT when close button was clicked
document.getElementById("dice-tray-handle")
  .addEventListener("click", (e) => {
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
      const slotKey = btn.dataset.slotKey;
      const n       = slotKey.split("-")[1];
      const label   = slotKey.startsWith("weapon") ? `Weapon ${n}` : `Armor ${n}`;
      const inputName = slotKey.startsWith("weapon")
        ? `attr_weapon_gear_a_${n}`
        : `attr_armor_gear_a_${n}`;
      const input = document.querySelector(`input[name="${inputName}"]`);
      const count = parseInt(input?.value) || 0;
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
      const count = parseInt(valInput?.value) || 0;
      toggleGear(slotKey, label, count);
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
