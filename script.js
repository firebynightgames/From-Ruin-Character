import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/+esm";

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

    if (saved.type === "checkbox") el.checked = !!saved.value;
    if (saved.type === "input") el.value = saved.value ?? "";
    if (saved.type === "textarea") el.value = saved.value ?? "";
    if (saved.type === "contenteditable") el.innerHTML = saved.value ?? "";
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

    document.getElementById('xp-header').style.display  = isGearTab ? 'none'  : 'block';
    document.getElementById('xp-body').style.display    = isGearTab ? 'none'  : 'flex';
    document.getElementById('bulk-header').style.display = isGearTab ? 'block' : 'none';
    document.getElementById('bulk-body').style.display   = isGearTab ? 'flex'  : 'none';
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

  const totalEl = document.getElementById('bulk-total');
  const thresholdEl = document.getElementById('bulk-threshold');
  const penaltyEl = document.getElementById('bulk-penalty');

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

/*================================================
   ACCORDION TOGGLES
   ================================================ */
document.querySelectorAll('.acc-header').forEach(button => {
  button.addEventListener('click', () => {
    button.nextElementSibling.classList.toggle('open');
  });
});

/* ================================================
   STRESS & TRAUMA GRID GENERATOR
   ================================================ */
const panel = document.querySelector('.sheet-panel');
if (panel) {
  const fragment = document.createDocumentFragment();
  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 6; col++) {
      const stress = document.createElement('input');
      stress.type = 'checkbox';
      stress.id = `stress-${row}-${col}`;
      stress.className = `track stress row-${row} col-${col}`;
      fragment.appendChild(stress);

      const trauma = document.createElement('input');
      trauma.type = 'checkbox';
      trauma.id = `trauma-${row}-${col}`;
      trauma.className = `track trauma row-${row} col-${col}`;
      fragment.appendChild(trauma);
    }
  }
  panel.appendChild(fragment);
}

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
   FEATURES LIST — AUTO GROW + ADD NEW ITEM
   ================================================ */
const list = document.querySelector('.features-list');
if (list) {
  list.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;

    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = list.querySelectorAll('textarea');
    const lastItem = items[items.length - 1];
    if (e.target === lastItem && lastItem.value.trim() !== '') {
      const newItem = document.createElement('li');
      newItem.innerHTML = '<textarea placeholder="Add a feature..." rows="1"></textarea>';
      list.appendChild(newItem);
    }
  });
}

/* ================================================
   DRIVES LIST — AUTO GROW HEIGHT & SLOTS (MAX 3)
   ================================================ */
const drivesList = document.querySelector('.drives-list');
if (drivesList) {
  drivesList.addEventListener('input', (e) => {
    // Make sure we are only reacting to typing in the textarea
    if (e.target.tagName !== 'TEXTAREA') return;

    // Expand height dynamically based on content length
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = drivesList.querySelectorAll('textarea');
    const lastItem = items[items.length - 1];
    
    // Generate new row (capped at 3) containing the text area AND the image tracker
    if (e.target === lastItem && lastItem.value.trim() !== '' && items.length < 3) {
      const nextIndex = items.length + 1;
      const newItem = document.createElement('li');
      
      // Injects the exact same flexbox layout for rows 2 and 3
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
   FLAWS LIST — AUTO GROW HEIGHT & SLOTS (MAX 3)
   ================================================ */
const flawsList = document.querySelector('.flaws-list');
if (flawsList) {
  flawsList.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return;

    // Expand height dynamically based on content length
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    const items = flawsList.querySelectorAll('textarea');
    const lastItem = items[items.length - 1];
    
    // Only generate a new row if we are typing in the current last slot AND we are under the 3-row limit
if (e.target === lastItem && lastItem.value.trim() !== '' && items.length < 3) {
      const nextIndex = items.length + 1;
      const newItem = document.createElement('li');
      newItem.innerHTML = `<textarea placeholder="Add a flaw..." rows="1" name="attr_flaw_${nextIndex}"></textarea>`;
      flawsList.appendChild(newItem);
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

/* ====================================================
   RELIC
==================================================== */
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
   PORTRAIT UPLOAD
   ================================================ */
const portraitUpload = document.getElementById('portrait-upload');
const portraitImg = document.getElementById('portrait-img');
const portraitLabel = document.querySelector('.portrait-upload-label');

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
    field.style.height = field.scrollHeight + 'px';  // remove field.style.
  });
});

/* ================================================
   DYNAMIC HEALTH LIMITER & CURRENT APTITUDES
   ================================================ */
function updateCurrentAptitudes() {
  const pairs = [
    ['finesse', 'devise',  1],
    ['exert',   'adapt',   2],
    ['sense',   'resist',  3],
    ['deceive', 'relate',  4]
  ];

  pairs.forEach(([apt1, apt2, rowIndex]) => {
    const traumaChecked = document.querySelectorAll(
      `.track.trauma.row-${rowIndex}:checked`
    ).length;

    [apt1, apt2].forEach(apt => {
      const base = parseInt(document.querySelector(`input[name="attr_${apt}"]`)?.value) || 0;
      const current = Math.max(0, base - traumaChecked);
      const el = document.getElementById(`cur-${apt}`);
      if (el) {
        if (traumaChecked > 0 && base > 0) {
          el.textContent = current;
          el.style.color = current === 0 ? 'red' : 'rgba(255,0,0,0.7)';
        } else {
          el.textContent = '';
        }
      }
    });
  });
}

function updateAllHealthLimits() {
  const rows = [
    ['finesse', 'devise', 1, 'hungry'],
    ['exert',   'adapt',  2, 'thirsty'],
    ['sense',   'resist', 3, 'exposed'],
    ['deceive', 'relate', 4, 'tired']
  ];

  rows.forEach(([apt1, apt2, rowIndex, condId]) => {
    const val1 = parseInt(document.querySelector(`input[name="attr_${apt1}"]`)?.value) || 0;
    const val2 = parseInt(document.querySelector(`input[name="attr_${apt2}"]`)?.value) || 0;
    const isConditionActive = document.getElementById(`cond-${condId}`)?.checked;
    const stressLimit = Math.min(val1, val2);
    const traumaLimit = Math.max(val1, val2);

    document.querySelectorAll(`.track.stress.row-${rowIndex}`).forEach((box, index) => {
      box.style.visibility = (index < stressLimit) ? 'visible' : 'hidden';
      box.disabled = (index >= stressLimit) || isConditionActive;
      box.style.opacity = isConditionActive ? '0.5' : '1';
    });

    document.querySelectorAll(`.track.trauma.row-${rowIndex}`).forEach((box, index) => {
      box.style.visibility = (index < traumaLimit) ? 'visible' : 'hidden';
      box.disabled = (index >= traumaLimit);
      if (box.disabled) box.checked = false;
    });
  });

  updateCurrentAptitudes();
}

const inputsToWatch = [
  'finesse','devise','exert','adapt','sense','resist','deceive','relate',
  'cond-hungry','cond-thirsty','cond-exposed','cond-tired'
];

inputsToWatch.forEach(name => {
  const el = document.querySelector(`input[name="attr_${name}"]`) || document.getElementById(name);
  el?.addEventListener('input', updateAllHealthLimits);
});

// Also watch trauma checkboxes directly
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('track') && e.target.classList.contains('trauma')) {
    updateCurrentAptitudes();
  }
});

// Run once on load
setTimeout(updateAllHealthLimits, 100);

document.addEventListener("DOMContentLoaded", () => {

  // 1. Load saved sheet
  const saved = storage.load();
  if (saved) writeSheetState(saved);

  // 2. Attach autosave to all fields
  getAllSheetFields().forEach(el => {
    const handler = () => storage.save();

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    } else if (el.isContentEditable) {
      el.addEventListener("input", handler);
      el.addEventListener("blur", handler);
    }
  });

  // 3. Your existing JS continues below this line
});

OBR.onReady(() => {
  OBR.viewport.setHeight(1200); // or any height you want
});
