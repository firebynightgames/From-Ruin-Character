import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/+esm";

/* ================================================
   CHARACTER MODEL
   (must be defined before updateStressTrauma uses it)
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
   CHARACTER STORAGE
   ================================================ */
const STORAGE_KEY = "fromRuinCharacter_v1";

function getAllSheetFields() {
  const root = document.getElementById("character-sheet");
  return Array.from(
    root.querySelectorAll(
      'input, textarea, [contenteditable="true"], [contenteditable=""]'
    )
  );
}

function readSheetState() {
  const fields = getAllSheetFields();
  return fields.map(el => {
    if (el.tagName === "INPUT") {
      if (el.type === "checkbox") return { type: "checkbox", value: el.checked };
      return { type: "input", value: el.value };
    }
    if (el.tagName === "TEXTAREA") {
      return { type: "textarea", value: el.value };
    }
    if (el.isContentEditable) {
      return { type: "contenteditable", value: el.innerHTML };
    }
    return { type: "unknown", value: null };
  });
}

function writeSheetState(values) {
  if (!values) return;
  const fields = getAllSheetFields();
  fields.forEach((el, i) => {
    const saved = values[i];
    if (!saved) return;

    if (saved.type === "checkbox" && el.type === "checkbox") el.checked = !!saved.value;
    if (saved.type === "input"    && el.tagName === "INPUT" && el.type !== "checkbox") el.value = saved.value ?? "";
    if (saved.type === "textarea" && el.tagName === "TEXTAREA") el.value = saved.value ?? "";
    if (saved.type === "contenteditable" && el.isContentEditable) el.innerHTML = saved.value ?? "";
  });
}

const storage = {
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readSheetState()));
  },
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

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

    document.getElementById('xp-header').style.display   = isGearTab ? 'none'  : 'block';
    document.getElementById('xp-body').style.display     = isGearTab ? 'none'  : 'flex';
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
  if (total > 20) {
    threshold = Math.ceil((total - 20) / 5) * 5 + 20;
  }

  const penalty = total <= 20 ? 0 : Math.ceil((total - 20) / 5);
  const maxed = penalty >= 6;

  const totalEl     = document.getElementById('bulk-total');
  const thresholdEl = document.getElementById('bulk-threshold');
  const penaltyEl   = document.getElementById('bulk-penalty');

  if (totalEl) {
    totalEl.textContent = total;
    totalEl.style.color = maxed ? 'red' : '#000';
  }
  if (thresholdEl) {
    thresholdEl.textContent = threshold;
    thresholdEl.style.color = maxed ? 'red' : '#000';
  }
  if (penaltyEl) {
    if (penalty <= 0) {
      penaltyEl.textContent = '';
    } else if (maxed) {
      penaltyEl.textContent = '+6 Difficulty (Max)';
    } else {
      penaltyEl.textContent = `+${penalty} Difficulty`;
    }
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

// NOTE: The old stress/trauma grid generator that used to live here has been
// removed. It was creating duplicate invisible checkboxes inside .sheet-panel
// that overlapped the visible pair-block checkboxes and corrupted save/load
// index alignment. The pair blocks in the HTML are the only stress/trauma UI.

/* ================================================
   WEAPON BLOCK GENERATOR
   ================================================ */
const weaponContainer = document.getElementById('weapons-container');
if (weaponContainer) {
  let weaponsHTML = '';
  for (let i = 1; i <= 5; i++) {
    weaponsHTML += `
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
      </div>
    `;
  }
  weaponContainer.innerHTML = weaponsHTML;
}

/* ================================================
   ARMOR BLOCK GENERATOR
   ================================================ */
const armorContainer = document.getElementById('armor-container');
if (armorContainer) {
  let armorHTML = '';
  for (let i = 1; i <= 5; i++) {
    armorHTML += `
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
      </div>
    `;
  }
  armorContainer.innerHTML = armorHTML;
}

/* ================================================
   SPELLS LIST — 10 ROW GENERATOR & AUTO-GROW
   ================================================ */
const spellsContainer = document.getElementById('spells-container');

function createSpellRowHTML(index) {
  return `
    <li class="spell-item-node">
      <div class="spell-item-grid">
        <textarea name="attr_spell_desc_${index}" placeholder="Add a spell or ritual..." rows="1"></textarea>
        <input type="number" name="attr_spell_difficulty_${index}" placeholder="-">
      </div>
    </li>
  `;
}

if (spellsContainer) {
  let initialSpells = '';
  for (let i = 1; i <= 10; i++) {
    initialSpells += createSpellRowHTML(i);
  }
  spellsContainer.innerHTML = initialSpells;

  spellsContainer.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;

    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const allSpells = spellsContainer.querySelectorAll('.spell-item-grid textarea');
    const lastSpell = allSpells[allSpells.length - 1];

    if (e.target === lastSpell && lastSpell.value.trim() !== '') {
      const nextIndex = allSpells.length + 1;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = createSpellRowHTML(nextIndex);
      spellsContainer.appendChild(tempDiv.firstElementChild);
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
    <input type="checkbox" class="wound-patch" name="attr_wound_patch_${index}" style="justify-self: end;">
  `;
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
    <span style="text-align: right;">Patched</span>
  `;
  woundsContainer.appendChild(headers);
  woundsContainer.appendChild(createWoundRow(1));

  woundsContainer.addEventListener('input', (e) => {
    if (!e.target.matches('input[type="text"]')) return;
    const rows = woundsContainer.querySelectorAll('.wound-row');
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

function addRelicRow() {
  const row = document.createElement('div');
  row.className = 'relic-row';
  row.innerHTML = `<textarea name="attr_relic_${Date.now()}" rows="1" placeholder="Name, Type, Effect..."></textarea>`;
  if (relicContainer) relicContainer.appendChild(row);
}

if (relicContainer) {
  for (let i = 0; i < 3; i++) addRelicRow();

  relicContainer.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    const rows = relicContainer.querySelectorAll('.relic-row');
    const lastRow = rows[rows.length - 1];
    if (e.target.closest('.relic-row') === lastRow && e.target.value.trim() !== '') {
      addRelicRow();
    }
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
    const lastItem = items[items.length - 1];
    if (e.target === lastItem && lastItem.value.trim() !== '') {
      const newItem = document.createElement('li');
      newItem.innerHTML = '<textarea placeholder="Add a feature..." rows="1"></textarea>';
      featuresList.appendChild(newItem);
    }
  });
}

/* ================================================
   DRIVES LIST — AUTO GROW HEIGHT & SLOTS (MAX 3)
   ================================================ */
const drivesList = document.querySelector('.drives-list');
if (drivesList) {
  drivesList.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;

    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = drivesList.querySelectorAll('textarea');
    const lastItem = items[items.length - 1];

    if (e.target === lastItem && lastItem.value.trim() !== '' && items.length < 3) {
      const nextIndex = items.length + 1;
      const newItem = document.createElement('li');
      newItem.innerHTML = `
        <div class="drive-item">
          <textarea placeholder="Add a drive..." rows="1" name="attr_drive_${nextIndex}"></textarea>
          <div class="drive-tracker">
            <input type="checkbox" name="attr_drive_${nextIndex}_cb_1" class="diamond-box db-1">
            <input type="checkbox" name="attr_drive_${nextIndex}_cb_2" class="diamond-box db-2">
            <input type="checkbox" name="attr_drive_${nextIndex}_cb_3" class="diamond-box db-3">
          </div>
        </div>
      `;
      drivesList.appendChild(newItem);
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
    const allRowInputs = container.querySelectorAll('.gear-row .col-gear-name input');
    const lastInput = allRowInputs[allRowInputs.length - 1];

    if (e.target === lastInput && lastInput.value.trim() !== '') {
      const nextIndex = allRowInputs.length + 1;
      const newRow = document.createElement('div');
      newRow.className = 'gear-row';
      newRow.innerHTML = `
        <div class="field-wrap col-gear-name">
          <input type="text" name="attr_gear_name_${nextIndex}" placeholder="-">
        </div>
        <div class="field-wrap col-gear-bulk">
          <input type="number" name="attr_gear_bulk_${nextIndex}" placeholder="-">
        </div>
      `;
      container.appendChild(newRow);
    }
  });
}

/* ================================================
   FLAWS LIST — AUTO GROW HEIGHT & SLOTS (MAX 3)
   ================================================ */
const flawsList = document.querySelector('.flaws-list');
if (flawsList) {
  flawsList.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;

    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = flawsList.querySelectorAll('textarea');
    const lastItem = items[items.length - 1];

    if (e.target === lastItem && lastItem.value.trim() !== '' && items.length < 3) {
      const nextIndex = items.length + 1;
      const newItem = document.createElement('li');
      newItem.innerHTML = `<textarea placeholder="Add a flaw..." rows="1" name="attr_flaw_${nextIndex}"></textarea>`;
      flawsList.appendChild(newItem);
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
      portraitImg.src = ev.target.result;
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
  ea: { key: "exert_adapt",    apt1: "exert",   apt2: "adapt" },
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
  const conditionActive = condBox?.checked;

  document.querySelectorAll(`.stress-box.${prefix}`).forEach((box, index) => {
    const allowed    = index < stressCap;
    box.disabled     = !allowed || conditionActive;
    box.style.opacity = conditionActive ? "0.5" : "1";
    if (!allowed) box.checked = false;
    character.stress[key][index] = box.checked;
  });

  document.querySelectorAll(`.trauma-box.${prefix}`).forEach((box, index) => {
    const allowed = index < traumaCap;
    box.disabled  = !allowed;
    if (!allowed) box.checked = false;
    character.trauma[key][index] = box.checked;
  });

  character.pairConditions[key] = conditionActive;
  updateCurrentAptitudes();
}

function updateAllPairs() {
  Object.keys(PAIR_MAP).forEach(prefix => updateStressTrauma(prefix));
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
    const prefix = [...e.target.classList]
      .find(c => ["fd","ea","sr","dr"].includes(c));
    if (prefix) updateStressTrauma(prefix);
  }
});

/* ================================================
   INIT — load saved state AFTER all generators run,
   then wire up autosave
   ================================================ */
document.addEventListener("DOMContentLoaded", () => {

  // All dynamic HTML (weapons, armor, spells, wounds, relics) is already
  // generated above by the time this fires, so field indices are stable.

  const saved = storage.load();
  if (saved) {
    writeSheetState(saved);
    // Re-sync derived UI after restoring values
    syncSummary();
    calculateTotalBulk();
  }

  // Run pair engine after values are loaded so caps reflect saved aptitudes
  updateAllPairs();

  // Autosave on every interaction
  function attachSaveListeners() {
    getAllSheetFields().forEach(el => {
      const save = () => storage.save();
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.addEventListener("input",  save);
        el.addEventListener("change", save);
      } else if (el.isContentEditable) {
        el.addEventListener("input", save);
        el.addEventListener("blur",  save);
      }
    });
  }

  attachSaveListeners();

  // Re-attach listeners when dynamic rows are added (wounds, gear, spells, etc.)
  // Use a single delegated observer so new fields are always covered
  const sheet = document.getElementById("character-sheet");
  new MutationObserver(() => {
    attachSaveListeners(); // safe to call repeatedly — addEventListener ignores dupes
  }).observe(sheet, { childList: true, subtree: true });
});

/* ================================================
   OBR
   ================================================ */
OBR.onReady(() => {
  OBR.viewport.setHeight(1200);
});
