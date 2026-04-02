'use strict';

const LABELS = {
  loc: { left: '左侧', right: '右侧', top: '头顶' },
  sev: { 1: '轻度', 2: '轻中度', 3: '中度', 4: '中重度', 5: '重度' },
  sevColor: { 1: '#86EFAC', 2: '#FDE68A', 3: '#FDBA74', 4: '#FCA5A5', 5: '#EF4444' },
  sevText: { 1: '#059669', 2: '#B45309', 3: '#C2410C', 4: '#DC2626', 5: '#DC2626' },
  trigger: { fatigue: '劳累/疲惫', screen: '用眼/专注', period: '生理期', sleep: '睡眠不足', weather: '天气变化', emotion: '情绪波动', cold: '受寒/吹风', talking: '说话过多', smell: '气味刺激' },
  relief: { sleep: '睡觉/休息', hot_wash: '洗热水头/澡', ibuprofen: '布洛芬', painkiller: '其他止痛药', taichong: '太冲穴', massage: '按摩', footbath: '泡脚', huoxiang: '藿香正气散', comb: '梳头', sneeze: '取嚏法', sun: '晒太阳', music: '音乐/金刚经' },
  symptom: { vomiting: '呕吐', nausea: '恶心', photophobia: '怕光', phonophobia: '怕声音', appetite_loss: '食欲下降', dizziness: '头晕', nasal: '鼻部不适', diarrhea: '腹泻', heavy_head: '脑袋昏沉' },
  prodromal: { drowsy: '困倦/打呵欠', chills: '畏寒/寒颤', sneeze: '打喷嚏', runny_nose: '流清鼻涕', head_foggy: '头部懵感', head_swell: '轻微头胀' },
  weather: { sunny: '晴', cloudy: '多云', overcast: '阴', rainy: '雨', hot: '闷热', cold_w: '寒冷', windy: '大风', humid: '潮湿' },
  medEffect: { effective: '有效', partial: '部分有效', ineffective: '无效' },
};

let currentUser = '';
function getUserPrefix() {
  return currentUser ? currentUser + '_' : '';
}
let STORAGE_KEY = 'migraine_tracker_data';
let CUSTOM_OPTIONS_KEY = 'migraine_tracker_custom_options';
let REMOVED_DEFAULTS_KEY = 'migraine_tracker_removed_defaults';
function initUserKeys() {
  const p = getUserPrefix();
  STORAGE_KEY = p + 'migraine_tracker_data';
  CUSTOM_OPTIONS_KEY = p + 'migraine_tracker_custom_options';
  REMOVED_DEFAULTS_KEY = p + 'migraine_tracker_removed_defaults';
}
function getAllUsers() {
  try { return JSON.parse(localStorage.getItem('migraine_tracker_users')) || []; }
  catch { return []; }
}
function saveUserList(users) { localStorage.setItem('migraine_tracker_users', JSON.stringify(users)); }
function registerUser(name) {
  const users = getAllUsers();
  if (!users.includes(name)) { users.push(name); saveUserList(users); }
}
function switchUser(name) {
  currentUser = name;
  initUserKeys();
  registerUser(name);
  const url = new URL(window.location);
  url.searchParams.set('user', name);
  window.history.replaceState({}, '', url);
  updateAppTitle();
  loadHistoricalData();
  migrateData();
  renderDashboard();
}
let calYear, calMonth, calSelected = null;
let historyFilter = 'all';
let statsYear = null;
let statsPeriodYear = null;
let statsCompareYears = [];
let statsRelYear = null;

function getCustomOptions(groupId) {
  try { const all = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY)) || {}; return all[groupId] || []; }
  catch { return []; }
}
function saveCustomOption(groupId, label) {
  const all = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}');
  if (!all[groupId]) all[groupId] = [];
  if (!all[groupId].includes(label)) all[groupId].push(label);
  localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(all));
  if (typeof triggerCloudSync === 'function') triggerCloudSync();
}
function removeCustomOption(groupId, label) {
  const all = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}');
  if (all[groupId]) all[groupId] = all[groupId].filter(v => v !== label);
  localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(all));
  if (typeof triggerCloudSync === 'function') triggerCloudSync();
}
function renderCustomChips(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.chip-custom').forEach(c => c.remove());
  const addBtn = group.querySelector('.chip-add-other');
  const options = getCustomOptions(groupId);
  options.forEach(label => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip chip-custom';
    chip.dataset.value = label;
    chip.innerHTML = `<span class="chip-text">${esc(label)}</span><span class="chip-remove" data-group="${esc(groupId)}" data-label="${esc(label)}">&times;</span>`;
    group.insertBefore(chip, addBtn);
  });
}
function getRemovedDefaults(groupId) {
  try { const all = JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY)) || {}; return all[groupId] || []; }
  catch { return []; }
}
function addRemovedDefault(groupId, value) {
  const all = JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '{}');
  if (!all[groupId]) all[groupId] = [];
  if (!all[groupId].includes(value)) all[groupId].push(value);
  localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(all));
  if (typeof triggerCloudSync === 'function') triggerCloudSync();
}
function makeDefaultChipsRemovable(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const removed = getRemovedDefaults(groupId);
  group.querySelectorAll('.chip:not(.chip-add-other):not(.chip-custom)').forEach(chip => {
    const val = chip.dataset.value;
    if (removed.includes(val)) { chip.remove(); return; }
    if (!chip.querySelector('.chip-remove')) {
      chip.classList.add('chip-removable');
      const text = chip.textContent;
      chip.textContent = '';
      const textSpan = document.createElement('span');
      textSpan.className = 'chip-text';
      textSpan.textContent = text;
      chip.appendChild(textSpan);
      const x = document.createElement('span');
      x.className = 'chip-remove';
      x.dataset.group = groupId;
      x.dataset.label = val;
      x.dataset.default = '1';
      x.innerHTML = '&times;';
      chip.appendChild(x);
    }
  });
}
function addCustomChip(groupId, label) {
  if (!label.trim()) return;
  label = label.trim();
  const group = document.getElementById(groupId);
  const existing = [...group.querySelectorAll('.chip')].find(c => c.dataset.value === label);
  if (existing) { existing.classList.add('active'); return; }
  saveCustomOption(groupId, label);
  renderCustomChips(groupId);
  const newChip = group.querySelector(`.chip[data-value="${CSS.escape(label)}"]`);
  if (newChip) newChip.classList.add('active');
  const inputRow = document.querySelector(`.custom-input-row[data-for="${groupId}"]`);
  if (inputRow) { inputRow.querySelector('input').value = ''; inputRow.classList.add('hidden'); }
  showToast(`已添加「${label}」`);
}

// ===== DATA =====
function getData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveData(records, skipSync) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  if (!skipSync && typeof triggerCloudSync === 'function') triggerCloudSync();
}
function getMigraines() { return getData().filter(r => r.type === 'migraine').sort((a, b) => b.startDate.localeCompare(a.startDate)); }
function getPeriods() { return getData().filter(r => r.type === 'period').sort((a, b) => b.startDate.localeCompare(a.startDate)); }
function addRecord(rec) { const d = getData(); d.push(rec); saveData(d); }
function updateRecord(rec) { const d = getData(); const i = d.findIndex(r => r.id === rec.id); if (i >= 0) d[i] = rec; saveData(d); }
function deleteRecord(id) { saveData(getData().filter(r => r.id !== id)); }
let _pendingDelete = null;
let _undoTimer = null;
function softDeleteRecord(rec) {
  _pendingDelete = JSON.parse(JSON.stringify(rec));
  deleteRecord(rec.id);
  refreshCurrentView();
  const label = rec.type === 'migraine' ? '偏头痛记录' : '经期记录';
  const el = document.getElementById('toast-undo');
  document.getElementById('toast-undo-msg').textContent = `已删除${label}`;
  el.classList.add('show');
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => {
    el.classList.remove('show');
    _pendingDelete = null;
  }, 5000);
}
function undoDelete() {
  if (!_pendingDelete) return;
  addRecord(_pendingDelete);
  _pendingDelete = null;
  clearTimeout(_undoTimer);
  document.getElementById('toast-undo').classList.remove('show');
  showToast('已撤销删除');
  refreshCurrentView();
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function migrateData() {
  const data = getData();
  let changed = false;
  data.forEach(r => {
    if (r.type === 'migraine' && r.date && !r.startDate) {
      r.startDate = r.date;
      r.startTime = r.time || '';
      r.endDate = r.endDate || '';
      r.endTime = r.endTime || '';
      r.durationHours = r.durationHours || null;
      r.weatherTags = r.weatherTags || [];
      r.sleepHours = r.sleepHours ?? null;
      r.diet24h = r.diet24h || '';
      r.postSymptoms = r.postSymptoms || '';
      r.postSymptomsDuration = r.postSymptomsDuration ?? null;
      r.medication = r.medication || null;
      delete r.date;
      delete r.time;
      changed = true;
    }
  });
  if (changed) saveData(data);
}

// ===== UTIL =====
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}
function fmtDateShort(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}
function fmtWeekday(d) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return '周' + days[new Date(d + 'T00:00:00').getDay()];
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() {
  return localDateStr(new Date());
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
function labelsFor(map, keys) {
  return (keys || []).map(k => map[k] || k).join('、');
}
function dateRange(startDate, endDate) {
  const dates = [];
  if (!startDate) return dates;
  const end = endDate || startDate;
  let cur = new Date(startDate + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    dates.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
function getPeriodDates(p) {
  if (p.endDate) return dateRange(p.startDate, p.endDate);
  if (p.duration && p.duration > 0) {
    const end = new Date(p.startDate + 'T00:00:00');
    end.setDate(end.getDate() + p.duration - 1);
    return dateRange(p.startDate, localDateStr(end));
  }
  return [p.startDate];
}
function getMigraineDates(m) {
  if (m.endDate) return dateRange(m.startDate, m.endDate);
  return [m.startDate];
}
function getPeriodRelation(migraineDate) {
  const periods = getPeriods().sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!periods.length) return '';
  let best = '';
  let bestAbs = Infinity;
  for (const p of periods) {
    const diff = daysBetween(p.startDate, migraineDate);
    const dur = p.duration || (p.endDate ? daysBetween(p.startDate, p.endDate) + 1 : 7);
    if (diff >= 0 && diff < dur) return `经期第${diff + 1}天`;
    if (diff >= dur) {
      const after = diff - dur + 1;
      if (after < bestAbs) { bestAbs = after; best = `经期后第${after}天`; }
    }
    if (diff < 0) {
      const before = -diff;
      if (before < bestAbs) { bestAbs = before; best = `经期前${before}天`; }
    }
  }
  return best;
}

// ===== NAVIGATION =====
function switchView(viewId, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector(`.nav-btn[data-view="${viewId}"]`)?.classList.add('active');
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'calendar') renderCalendar();
  if (viewId === 'history') renderHistory();
  if (viewId === 'stats') renderStats();
}
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showRecordMigraine(editRecord) {
  const form = document.getElementById('form-migraine');
  form.reset();
  document.getElementById('m-edit-id').value = '';
  clearChips('m-locations'); clearChips('m-triggers'); clearChips('m-relief');
  clearChips('m-symptoms'); clearChips('m-prodromal'); clearChips('m-weather');
  clearChips('m-med-taken'); clearSeverity();
  document.getElementById('m-med-details').classList.add('hidden');
  document.getElementById('m-med-list').innerHTML = '';
  medEntryCounter = 0;
  goToStep(1);
  ['m-symptoms','m-prodromal','m-triggers','m-weather','m-relief'].forEach(gid => {
    makeDefaultChipsRemovable(gid);
    renderCustomChips(gid);
    const row = document.querySelector(`.custom-input-row[data-for="${gid}"]`);
    if (row) { row.classList.add('hidden'); row.querySelector('input').value = ''; }
  });
  document.getElementById('m-duration-display').textContent = '填写开始和结束时间后自动计算';
  document.getElementById('m-duration-val').value = '';

  if (editRecord) {
    document.getElementById('m-edit-id').value = editRecord.id;
    if (editRecord.startDate) {
      document.getElementById('m-start-dt').value = editRecord.startDate + 'T' + (editRecord.startTime || '18:00');
    }
    if (editRecord.endDate && editRecord.endTime) {
      document.getElementById('m-end-dt').value = editRecord.endDate + 'T' + editRecord.endTime;
    } else if (editRecord.endDate) {
      document.getElementById('m-end-dt').value = editRecord.endDate + 'T00:00';
    }
    setChips('m-locations', editRecord.locations);
    setSeverity(editRecord.severity);
    setChips('m-triggers', editRecord.triggers);
    setChips('m-relief', editRecord.relief);
    setChips('m-symptoms', editRecord.symptoms);
    setChips('m-prodromal', editRecord.prodromal);
    setChips('m-weather', editRecord.weatherTags);
    document.getElementById('m-sleep').value = editRecord.sleepHours ?? '';
    document.getElementById('m-diet').value = editRecord.diet24h || '';
    document.getElementById('m-post-symptoms').value = editRecord.postSymptoms || '';
    document.getElementById('m-post-duration').value = editRecord.postSymptomsDuration ?? '';
    document.getElementById('m-notes').value = editRecord.notes || '';
    const meds = editRecord.medications && editRecord.medications.length
      ? editRecord.medications
      : (editRecord.medication ? [editRecord.medication] : []);
    if (meds.length) {
      setSingleChip('m-med-taken', 'yes');
      document.getElementById('m-med-details').classList.remove('hidden');
      meds.forEach(m => addMedEntry(m));
    }
    calcDuration();
  } else {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('m-start-dt').value = local;
  }
  openModal('modal-migraine');
}
function showRecordPeriod(editRecord) {
  const form = document.getElementById('form-period');
  form.reset();
  document.getElementById('p-edit-id').value = '';
  if (editRecord) {
    document.getElementById('p-edit-id').value = editRecord.id;
    document.getElementById('p-start').value = editRecord.startDate;
    document.getElementById('p-end').value = editRecord.endDate || '';
    document.getElementById('p-duration').value = editRecord.duration || '';
    document.getElementById('p-pads').value = editRecord.padUsage || '';
    document.getElementById('p-notes').value = editRecord.notes || '';
  } else {
    document.getElementById('p-start').value = todayStr();
  }
  openModal('modal-period');
}
function showSettings() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.getElementById('theme-toggle-label').textContent = isDark ? '切换浅色模式' : '切换暗色模式';
  if (typeof updateCloudUI === 'function') updateCloudUI();
  openModal('modal-settings');
}
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? '' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('migraine_theme', next);
  document.getElementById('theme-toggle-label').textContent = next === 'dark' ? '切换浅色模式' : '切换暗色模式';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'dark' ? '#111827' : '#7C3AED');
}
function loadTheme() {
  const saved = localStorage.getItem('migraine_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && saved === 'dark') meta.setAttribute('content', '#111827');
  }
}

// ===== CHIPS =====
function clearChips(groupId) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove('active'));
}
function setChips(groupId, values) {
  if (!values) return;
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => {
    if (values.includes(c.dataset.value)) c.classList.add('active');
  });
}
function getChips(groupId) {
  return [...document.querySelectorAll(`#${groupId} .chip.active`)].map(c => c.dataset.value);
}
function setSingleChip(groupId, value) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => {
    c.classList.toggle('active', c.dataset.value === value);
  });
}
function getSingleChip(groupId) {
  const btn = document.querySelector(`#${groupId} .chip.active`);
  return btn ? btn.dataset.value : '';
}
function clearSeverity() {
  document.querySelectorAll('#m-severity .severity-btn').forEach(b => b.classList.remove('active'));
}
function setSeverity(val) {
  document.querySelectorAll('#m-severity .severity-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value == val);
  });
}
function getSeverity() {
  const btn = document.querySelector('#m-severity .severity-btn.active');
  return btn ? parseInt(btn.dataset.value) : 0;
}

// ===== STEP FORM =====
let currentStep = 1;
const STEP_TITLES = { 1: '第 1 步 · 基本信息', 2: '第 2 步 · 症状与诱因', 3: '第 3 步 · 缓解与用药' };

function goToStep(step) {
  if (step > currentStep && step >= 2) {
    const severity = getSeverity();
    if (!severity) { showToast('请先选择严重程度'); return; }
    const locations = getChips('m-locations');
    if (!locations.length) { showToast('请先选择疼痛部位'); return; }
  }
  currentStep = step;
  document.querySelectorAll('.form-step').forEach(s => s.classList.toggle('active', parseInt(s.dataset.step) === step));
  document.querySelectorAll('.step-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.classList.toggle('active', s === step);
    d.classList.toggle('done', s < step);
  });
  document.querySelectorAll('.step-line').forEach((line, i) => {
    line.classList.toggle('done', i + 1 < step);
  });
  document.getElementById('step-title').textContent = STEP_TITLES[step];
  document.querySelector('#modal-migraine .modal-content').scrollTop = 0;
}

// ===== MULTI-MED =====
let medEntryCounter = 0;
function addMedEntry(data) {
  const list = document.getElementById('m-med-list');
  const idx = medEntryCounter++;
  const entry = document.createElement('div');
  entry.className = 'med-entry';
  entry.dataset.medIdx = idx;
  entry.innerHTML = `
    <div class="med-entry-header">
      <span>药物 #${list.children.length + 1}</span>
      <button type="button" class="med-entry-remove" onclick="removeMedEntry(this)">&times;</button>
    </div>
    <div class="form-group">
      <label>药物名称</label>
      <input type="text" class="med-name" placeholder="例如: 布洛芬" value="${esc(data?.name || '')}">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label>剂量</label>
        <input type="text" class="med-dosage" placeholder="例如: 400mg" value="${esc(data?.dosage || '')}">
      </div>
      <div class="form-group" style="flex:1">
        <label>服用时间</label>
        <input type="time" class="med-time" value="${data?.time || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>药物是否有效</label>
      <div class="chip-group single-select med-effective">
        <button type="button" class="chip${data?.effective === 'effective' ? ' active' : ''}" data-value="effective">有效</button>
        <button type="button" class="chip${data?.effective === 'partial' ? ' active' : ''}" data-value="partial">部分有效</button>
        <button type="button" class="chip${data?.effective === 'ineffective' ? ' active' : ''}" data-value="ineffective">无效</button>
      </div>
    </div>
  `;
  list.appendChild(entry);
  entry.querySelectorAll('.med-effective').forEach(g => {
    g.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      g.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}
function removeMedEntry(btn) {
  const entry = btn.closest('.med-entry');
  entry.remove();
  renumberMedEntries();
}
function renumberMedEntries() {
  document.querySelectorAll('#m-med-list .med-entry').forEach((e, i) => {
    e.querySelector('.med-entry-header span').textContent = `药物 #${i + 1}`;
  });
}
function getMedications() {
  const entries = document.querySelectorAll('#m-med-list .med-entry');
  const meds = [];
  entries.forEach(entry => {
    const effBtn = entry.querySelector('.med-effective .chip.active');
    meds.push({
      name: entry.querySelector('.med-name').value.trim(),
      dosage: entry.querySelector('.med-dosage').value.trim(),
      time: entry.querySelector('.med-time').value,
      effective: effBtn ? effBtn.dataset.value : '',
    });
  });
  return meds;
}

// ===== DURATION CALC =====
function calcDuration() {
  const startVal = document.getElementById('m-start-dt').value;
  const endVal = document.getElementById('m-end-dt').value;
  const display = document.getElementById('m-duration-display');
  const hidden = document.getElementById('m-duration-val');
  if (startVal && endVal) {
    const ms = new Date(endVal) - new Date(startVal);
    if (ms > 0) {
      const hours = (ms / 3600000).toFixed(1);
      display.textContent = `${hours} 小时`;
      hidden.value = hours;
    } else {
      display.textContent = '结束时间须晚于开始时间';
      hidden.value = '';
    }
  } else {
    display.textContent = '填写开始和结束时间后自动计算';
    hidden.value = '';
  }
}

// ===== SAVE FORMS =====
function saveMigraine(e) {
  if (e) e.preventDefault();
  const severity = getSeverity();
  if (!severity) { showToast('请选择严重程度'); return; }
  const locations = getChips('m-locations');
  if (!locations.length) { showToast('请选择疼痛部位'); return; }

  const startDtVal = document.getElementById('m-start-dt').value;
  if (!startDtVal) { showToast('请选择发作时间'); return; }
  const endDtVal = document.getElementById('m-end-dt').value;
  const startDate = startDtVal.slice(0, 10);
  const startTime = startDtVal.slice(11, 16);
  const endDate = endDtVal ? endDtVal.slice(0, 10) : '';
  const endTime = endDtVal ? endDtVal.slice(11, 16) : '';
  const durationHours = parseFloat(document.getElementById('m-duration-val').value) || null;

  let medication = null;
  let medications = [];
  if (getSingleChip('m-med-taken') === 'yes') {
    medications = getMedications();
    if (medications.length) medication = medications[0];
  }

  const rec = {
    id: document.getElementById('m-edit-id').value || genId(),
    type: 'migraine',
    startDate, startTime, endDate, endTime, durationHours,
    locations, severity,
    triggers: getChips('m-triggers'),
    relief: getChips('m-relief'),
    symptoms: getChips('m-symptoms'),
    prodromal: getChips('m-prodromal'),
    weatherTags: getChips('m-weather'),
    sleepHours: parseFloat(document.getElementById('m-sleep').value) || null,
    diet24h: document.getElementById('m-diet').value.trim(),
    postSymptoms: document.getElementById('m-post-symptoms').value.trim(),
    postSymptomsDuration: parseFloat(document.getElementById('m-post-duration').value) || null,
    medication,
    medications,
    notes: document.getElementById('m-notes').value.trim(),
  };
  if (document.getElementById('m-edit-id').value) updateRecord(rec);
  else addRecord(rec);
  closeModal('modal-migraine');
  showToast('已保存偏头痛记录');
  refreshCurrentView();
}

function savePeriod(e) {
  e.preventDefault();
  const startDate = document.getElementById('p-start').value;
  if (!startDate) return;
  const endDate = document.getElementById('p-end').value || '';
  let duration = parseInt(document.getElementById('p-duration').value) || null;
  if (!duration && startDate && endDate) {
    duration = daysBetween(startDate, endDate) + 1;
  }
  const padUsage = document.getElementById('p-pads').value.trim();
  const allPeriods = getPeriods().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const editId = document.getElementById('p-edit-id').value;
  const prevPeriod = allPeriods.filter(p => p.startDate < startDate && p.id !== editId).pop();
  const cycleLength = prevPeriod ? daysBetween(prevPeriod.startDate, startDate) : null;
  const rec = {
    id: editId || genId(),
    type: 'period', startDate, endDate, duration, cycleLength, padUsage,
    notes: document.getElementById('p-notes').value.trim(),
  };
  if (editId) updateRecord(rec);
  else addRecord(rec);
  closeModal('modal-period');
  showToast('已保存经期记录');
  refreshCurrentView();
}

function refreshCurrentView() {
  const active = document.querySelector('.view.active');
  if (active) {
    const id = active.id.replace('view-', '');
    if (id === 'dashboard') renderDashboard();
    if (id === 'calendar') renderCalendar();
    if (id === 'history') renderHistory();
    if (id === 'stats') renderStats();
  }
}

// ===== DASHBOARD =====
function renderDashboard() {
  const migraines = getMigraines();
  const periods = getPeriods();
  const today = todayStr();
  const last30 = new Date(); last30.setDate(last30.getDate() - 30);
  const last30Str = localDateStr(last30);
  const thisMonthCount = migraines.filter(m => m.startDate >= last30Str).length;
  let daysSinceLast = '—';
  if (migraines.length) daysSinceLast = daysBetween(migraines[0].startDate, today);
  let nextPeriodStr = '—';
  if (periods.length >= 2) {
    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const cycleLengths = [];
    for (let i = 1; i < sorted.length; i++) {
      const cl = daysBetween(sorted[i - 1].startDate, sorted[i].startDate);
      if (cl > 0 && cl < 60) cycleLengths.push(cl);
    }
    if (cycleLengths.length) {
      const avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
      const lastPeriod = sorted[sorted.length - 1];
      const nextDate = new Date(lastPeriod.startDate + 'T00:00:00');
      nextDate.setDate(nextDate.getDate() + avgCycle);
      const daysUntil = daysBetween(today, localDateStr(nextDate));
      if (daysUntil > 0) nextPeriodStr = `约${daysUntil}天`;
      else if (daysUntil === 0) nextPeriodStr = '今天';
      else nextPeriodStr = `已过${-daysUntil}天`;
    }
  }
  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${daysSinceLast}</div><div class="stat-label">距上次头痛(天)</div></div>
    <div class="stat-card"><div class="stat-value">${thisMonthCount}</div><div class="stat-label">近30天发作</div></div>
    <div class="stat-card"><div class="stat-value pink">${nextPeriodStr}</div><div class="stat-label">预计下次经期</div></div>
  `;
  const allRecords = [
    ...migraines.map(m => ({ ...m, sortDate: m.startDate })),
    ...periods.map(p => ({ ...p, sortDate: p.startDate })),
  ];
  allRecords.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  const recent = allRecords.slice(0, 5);
  document.getElementById('recent-records').innerHTML = recent.length
    ? recent.map(r => renderRecordCard(r)).join('')
    : '<div class="empty-state">暂无记录</div>';
}

function renderRecordCard(r) {
  if (r.type === 'migraine') {
    const sevLabel = LABELS.sev[r.severity] || '';
    const sevBg = LABELS.sevColor[r.severity] || '#eee';
    const sevTxt = LABELS.sevText[r.severity] || '#666';
    const locs = (r.locations || []).map(l => LABELS.loc[l] || l).join('+');
    const relation = getPeriodRelation(r.startDate);
    let dateDisplay = fmtDate(r.startDate) + ' ' + fmtWeekday(r.startDate);
    if (r.durationHours) dateDisplay += ` · ${r.durationHours}h`;
    return `<div class="record-card" onclick='showDetail(${JSON.stringify(r.id)})'>
      <div class="card-header">
        <span class="card-badge migraine"></span>
        <span class="card-date">${esc(dateDisplay)}</span>
        <span class="card-severity" style="background:${sevBg}20;color:${sevTxt}">${esc(sevLabel)}</span>
      </div>
      <div class="card-body">${esc(locs)}${relation ? ' · ' + esc(relation) : ''}</div>
      ${(r.triggers && r.triggers.length) ? `<div class="card-tags">${r.triggers.map(t => `<span class="card-tag">${esc(LABELS.trigger[t] || t)}</span>`).join('')}</div>` : ''}
    </div>`;
  } else {
    const dur = r.duration ? `${r.duration}天` : '';
    const cycle = r.cycleLength ? `周期${r.cycleLength}天` : '';
    return `<div class="record-card" onclick='showDetail(${JSON.stringify(r.id)})'>
      <div class="card-header">
        <span class="card-badge period"></span>
        <span class="card-date">${esc(fmtDate(r.startDate))} ${esc(fmtWeekday(r.startDate))}</span>
        <span class="card-severity" style="background:#FCE7F3;color:#EC4899">经期</span>
      </div>
      <div class="card-body">${esc([dur, cycle].filter(Boolean).join(' · ') || '经期开始')}</div>
    </div>`;
  }
}

// ===== DETAIL =====
function showDetail(id) {
  const rec = getData().find(r => r.id === id);
  if (!rec) return;
  const title = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');
  const editBtn = document.getElementById('detail-edit-btn');
  const deleteBtn = document.getElementById('detail-delete-btn');

  if (rec.type === 'migraine') {
    title.textContent = '偏头痛详情';
    const relation = getPeriodRelation(rec.startDate);
    const timeRange = (rec.startTime || '') + (rec.endDate ? ` → ${rec.endDate !== rec.startDate ? fmtDate(rec.endDate) + ' ' : ''}${rec.endTime || ''}` : '');
    let medHtml = '';
    const allMeds = rec.medications && rec.medications.length
      ? rec.medications
      : (rec.medication ? [rec.medication] : []);
    if (allMeds.length) {
      medHtml = allMeds.map((m, i) => {
        const parts = [m.name, m.dosage, m.time ? `${m.time}服用` : ''].filter(Boolean);
        if (m.effective) parts.push(LABELS.medEffect[m.effective] || m.effective);
        const label = allMeds.length > 1 ? `止痛药${i + 1}` : '止痛药';
        return `<div class="detail-row"><span class="detail-label">${esc(label)}</span><span class="detail-value">${esc(parts.join('，'))}</span></div>`;
      }).join('');
    }
    body.innerHTML = `
      <div class="detail-row"><span class="detail-label">开始</span><span class="detail-value">${esc(fmtDate(rec.startDate))} ${esc(fmtWeekday(rec.startDate))} ${esc(rec.startTime || '')}</span></div>
      ${rec.endDate ? `<div class="detail-row"><span class="detail-label">结束</span><span class="detail-value">${esc(fmtDate(rec.endDate))} ${esc(rec.endTime || '')}</span></div>` : ''}
      ${rec.durationHours ? `<div class="detail-row"><span class="detail-label">持续</span><span class="detail-value">${esc(rec.durationHours)} 小时</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">部位</span><span class="detail-value">${esc(labelsFor(LABELS.loc, rec.locations))}</span></div>
      <div class="detail-row"><span class="detail-label">程度</span><span class="detail-value">${esc(LABELS.sev[rec.severity] || '')}</span></div>
      ${relation ? `<div class="detail-row"><span class="detail-label">经期关系</span><span class="detail-value">${esc(relation)}</span></div>` : ''}
      ${rec.weatherTags?.length ? `<div class="detail-row"><span class="detail-label">天气</span><span class="detail-value">${esc(labelsFor(LABELS.weather, rec.weatherTags))}</span></div>` : ''}
      ${rec.sleepHours != null ? `<div class="detail-row"><span class="detail-label">睡眠</span><span class="detail-value">${esc(rec.sleepHours)} 小时</span></div>` : ''}
      ${rec.diet24h ? `<div class="detail-row"><span class="detail-label">饮食</span><span class="detail-value">${esc(rec.diet24h)}</span></div>` : ''}
      ${rec.triggers?.length ? `<div class="detail-row"><span class="detail-label">诱因</span><span class="detail-value">${esc(labelsFor(LABELS.trigger, rec.triggers))}</span></div>` : ''}
      ${rec.symptoms?.length ? `<div class="detail-row"><span class="detail-label">伴随症状</span><span class="detail-value">${esc(labelsFor(LABELS.symptom, rec.symptoms))}</span></div>` : ''}
      ${rec.prodromal?.length ? `<div class="detail-row"><span class="detail-label">前驱症状</span><span class="detail-value">${esc(labelsFor(LABELS.prodromal, rec.prodromal))}</span></div>` : ''}
      ${rec.relief?.length ? `<div class="detail-row"><span class="detail-label">缓解方法</span><span class="detail-value">${esc(labelsFor(LABELS.relief, rec.relief))}</span></div>` : ''}
      ${medHtml}
      ${rec.postSymptoms ? `<div class="detail-row"><span class="detail-label">头痛后</span><span class="detail-value">${esc(rec.postSymptoms)}${rec.postSymptomsDuration ? `（持续${esc(rec.postSymptomsDuration)}h）` : ''}</span></div>` : ''}
      ${rec.notes ? `<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${esc(rec.notes)}</span></div>` : ''}
    `;
    editBtn.onclick = () => { closeModal('modal-detail'); showRecordMigraine(rec); };
  } else {
    title.textContent = '经期详情';
    body.innerHTML = `
      <div class="detail-row"><span class="detail-label">开始日期</span><span class="detail-value">${esc(fmtDate(rec.startDate))}</span></div>
      ${rec.endDate ? `<div class="detail-row"><span class="detail-label">结束日期</span><span class="detail-value">${esc(fmtDate(rec.endDate))}</span></div>` : ''}
      ${rec.duration ? `<div class="detail-row"><span class="detail-label">持续天数</span><span class="detail-value">${esc(rec.duration)}天</span></div>` : ''}
      ${rec.cycleLength ? `<div class="detail-row"><span class="detail-label">周期天数</span><span class="detail-value">${esc(rec.cycleLength)}天</span></div>` : ''}
      ${rec.padUsage ? `<div class="detail-row"><span class="detail-label">卫生巾</span><span class="detail-value">每日: ${esc(rec.padUsage)}</span></div>` : ''}
      ${rec.notes ? `<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${esc(rec.notes)}</span></div>` : ''}
    `;
    editBtn.onclick = () => { closeModal('modal-detail'); showRecordPeriod(rec); };
  }
  deleteBtn.onclick = () => {
    softDeleteRecord(rec);
    closeModal('modal-detail');
  };
  openModal('modal-detail');
}

// ===== CALENDAR =====
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  title.textContent = `${calYear}年${calMonth + 1}月`;
  const firstDay = new Date(calYear, calMonth, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();
  const migraines = getMigraines();
  const periods = getPeriods();

  const migraineDateSet = new Set();
  migraines.forEach(m => getMigraineDates(m).forEach(d => migraineDateSet.add(d)));

  const periodDateSet = new Set();
  periods.forEach(p => getPeriodDates(p).forEach(d => periodDateSet.add(d)));

  let html = '';
  for (let i = 0; i < startDow; i++) html += '<button class="cal-day empty"></button>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = ds === today;
    const isSel = ds === calSelected;
    const hasM = migraineDateSet.has(ds);
    const hasP = periodDateSet.has(ds);
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (isSel) cls += ' selected';
    if (hasP && !isSel) cls += ' period-bg';
    html += `<button class="${cls}" onclick="selectDay('${ds}')">
      ${d}
      <span class="cal-dots">${hasM ? '<span class="cal-dot m"></span>' : ''}${hasP ? '<span class="cal-dot p"></span>' : ''}</span>
    </button>`;
  }
  grid.innerHTML = html;
  if (calSelected) renderDayDetail(calSelected);
  else document.getElementById('calendar-day-detail').innerHTML = '';
}
function calendarPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } calSelected = null; renderCalendar(); }
function calendarNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } calSelected = null; renderCalendar(); }
function showCalendarJump() {
  const yr = getYearRange();
  const selY = document.getElementById('cal-jump-year');
  const selM = document.getElementById('cal-jump-month');
  selY.innerHTML = '';
  for (let y = yr.min; y <= yr.max; y++) {
    selY.innerHTML += `<option value="${y}"${y === calYear ? ' selected' : ''}>${y}年</option>`;
  }
  selM.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    selM.innerHTML += `<option value="${m - 1}"${m - 1 === calMonth ? ' selected' : ''}>${m}月</option>`;
  }
  openModal('modal-cal-jump');
}
function doCalendarJump() {
  calYear = parseInt(document.getElementById('cal-jump-year').value);
  calMonth = parseInt(document.getElementById('cal-jump-month').value);
  calSelected = null;
  closeModal('modal-cal-jump');
  renderCalendar();
}
function selectDay(ds) {
  calSelected = calSelected === ds ? null : ds;
  renderCalendar();
}
function renderDayDetail(ds) {
  const container = document.getElementById('calendar-day-detail');
  const dayMigraines = getMigraines().filter(m => getMigraineDates(m).includes(ds));
  const dayPeriods = getPeriods().filter(p => getPeriodDates(p).includes(ds));
  if (!dayMigraines.length && !dayPeriods.length) {
    container.innerHTML = `<div class="empty-state" style="padding:20px">
      ${fmtDateShort(ds)} 无记录
      <div style="margin-top:10px">
        <button class="chip" onclick="calSelected=null;showRecordMigraine()" style="margin:4px">+ 记录头痛</button>
        <button class="chip" onclick="calSelected=null;showRecordPeriod()" style="margin:4px">+ 记录经期</button>
      </div>
    </div>`;
    return;
  }
  let html = `<div class="section-title">${fmtDateShort(ds)} ${fmtWeekday(ds)}</div>`;
  dayMigraines.forEach(r => { html += renderRecordCard(r); });
  dayPeriods.forEach(r => { html += renderRecordCard(r); });
  container.innerHTML = html;
}

// ===== HISTORY =====
function renderHistory() {
  applyHistoryFilters();
}
function filterHistory(filter, btn) {
  historyFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyHistoryFilters();
}
function applyHistoryFilters() {
  const container = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  const keyword = (document.getElementById('history-search')?.value || '').trim().toLowerCase();
  const dateFrom = document.getElementById('search-date-from')?.value || '';
  const dateTo = document.getElementById('search-date-to')?.value || '';
  const sevFilter = document.getElementById('search-severity')?.value || '';

  let records;
  if (historyFilter === 'migraine') records = getMigraines().map(r => ({ ...r, sortDate: r.startDate }));
  else if (historyFilter === 'period') records = getPeriods().map(r => ({ ...r, sortDate: r.startDate }));
  else records = [
    ...getMigraines().map(r => ({ ...r, sortDate: r.startDate })),
    ...getPeriods().map(r => ({ ...r, sortDate: r.startDate })),
  ];

  if (dateFrom) records = records.filter(r => r.sortDate >= dateFrom);
  if (dateTo) records = records.filter(r => r.sortDate <= dateTo);
  if (sevFilter) records = records.filter(r => r.type === 'migraine' && String(r.severity) === sevFilter);

  if (keyword) {
    records = records.filter(r => {
      const fields = [
        r.notes, r.diet24h, r.postSymptoms,
        ...(r.locations || []).map(l => LABELS.loc[l] || l),
        ...(r.triggers || []).map(t => LABELS.trigger[t] || t),
        ...(r.symptoms || []).map(s => LABELS.symptom[s] || s),
        ...(r.relief || []).map(s => LABELS.relief[s] || s),
        ...(r.prodromal || []).map(s => LABELS.prodromal[s] || s),
        ...(r.weatherTags || []).map(w => LABELS.weather[w] || w),
        r.startDate, LABELS.sev[r.severity] || '',
      ];
      const allMeds = r.medications?.length ? r.medications : (r.medication ? [r.medication] : []);
      allMeds.forEach(m => { if (m.name) fields.push(m.name); });
      return fields.some(f => f && String(f).toLowerCase().includes(keyword));
    });
  }

  records.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  const totalAll = getData().length;
  if (countEl) {
    if (keyword || dateFrom || dateTo || sevFilter || historyFilter !== 'all') {
      countEl.textContent = `找到 ${records.length} 条记录（共 ${totalAll} 条）`;
    } else {
      countEl.textContent = '';
    }
  }
  if (!records.length) { container.innerHTML = '<div class="empty-state">暂无匹配记录</div>'; return; }
  let html = '';
  let lastMonth = '';
  records.forEach(r => {
    const month = r.sortDate.slice(0, 7);
    if (month !== lastMonth) {
      const [y, m] = month.split('-');
      html += `<div class="section-title" style="margin-top:${lastMonth ? '16px' : '0'}">${y}年${parseInt(m)}月</div>`;
      lastMonth = month;
    }
    html += renderRecordCard(r);
  });
  container.innerHTML = html;
}

function getYearRange() {
  const years = getData().map(r => parseInt((r.startDate || '').slice(0, 4))).filter(y => y > 2000);
  const cur = new Date().getFullYear();
  const min = years.length ? Math.min(...years) : cur;
  const max = Math.max(cur + 1, ...(years.length ? [Math.max(...years) + 1] : []));
  return { min, max };
}
function yearOptions(selected, range) {
  let html = '';
  for (let y = range.min; y <= range.max; y++) {
    html += `<option value="${y}"${String(y) === selected ? ' selected' : ''}>${y}年</option>`;
  }
  return html;
}

function toggleStatSection(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('collapsed');
}

// ===== STATISTICS =====
function selectStatsYear(el) {
  statsYear = typeof el === 'string' ? el : el.value;
  renderStats();
}
function selectStatsRelYear(el) {
  statsRelYear = typeof el === 'string' ? el : el.value;
  renderStats();
}
function selectStatsPeriodYear(el) {
  statsPeriodYear = typeof el === 'string' ? el : el.value;
  renderStats();
}
function toggleCompareYear(year) {
  const idx = statsCompareYears.indexOf(year);
  if (idx >= 0) {
    if (statsCompareYears.length <= 2) return;
    statsCompareYears.splice(idx, 1);
  } else {
    statsCompareYears.push(year);
    statsCompareYears.sort();
  }
  renderStats();
}
function renderStats() {
  const migraines = getMigraines();
  const periods = getPeriods();
  if (!migraines.length && !periods.length) {
    document.getElementById('stats-content').innerHTML = '<div class="empty-state">暂无数据</div>';
    return;
  }
  let html = '';

  const curYear = new Date().getFullYear();
  if (!statsYear) statsYear = String(curYear);
  const monthCounts = {};
  migraines.forEach(m => {
    const key = m.startDate.slice(0, 7);
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });

  if (migraines.length) {
    const yearTotal = migraines.filter(m => m.startDate.startsWith(statsYear)).length;
    const yearMonthCounts = [];
    let maxCount = 0;
    for (let mo = 1; mo <= 12; mo++) {
      const key = `${statsYear}-${String(mo).padStart(2, '0')}`;
      const c = monthCounts[key] || 0;
      yearMonthCounts.push(c);
      if (c > maxCount) maxCount = c;
    }

    html += `<div class="stat-section" id="sec-migraine-yearly">`;
    const yr = getYearRange();
    html += `<div class="stat-section-header" onclick="toggleStatSection('sec-migraine-yearly')"><div class="trend-year-row" style="flex:1;margin-bottom:0"><h3 style="margin:0">偏头痛年度统计</h3><div class="trend-year-right"><select class="year-select" onclick="event.stopPropagation()" onchange="selectStatsYear(this)">${yearOptions(statsYear, yr)}</select><span class="trend-year-total">共 <strong>${yearTotal}</strong> 次</span></div></div><svg class="collapse-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>`;
    html += `<div class="stat-section-body">`;

    html += `<div class="stat-sub-title" style="margin-top:14px">月度发作趋势</div>`;
    html += `<div class="trend-chart-area"><div class="trend-chart">`;
    for (let mo = 0; mo < 12; mo++) {
      const c = yearMonthCounts[mo];
      const h = maxCount > 0 ? (c / maxCount * 70) : 0;
      const barH = c > 0 ? Math.max(h, 4) : 0;
      html += `<div class="trend-col"><span class="trend-bar-count">${c || ''}</span><div class="trend-bar" style="height:${barH}px"></div></div>`;
    }
    html += `</div><div class="trend-labels">`;
    for (let mo = 0; mo < 12; mo++) {
      html += `<div class="trend-bar-label">${mo + 1}月</div>`;
    }
    html += `</div></div>`;

    const yearMigraines = migraines.filter(m => m.startDate.startsWith(statsYear));
    const sevCounts = {};
    yearMigraines.forEach(m => { sevCounts[m.severity] = (sevCounts[m.severity] || 0) + 1; });
    const sevTotal = yearMigraines.length;
    const maxSev = Math.max(...Object.values(sevCounts), 1);
    html += `<div class="stat-sub-title" style="margin-top:20px">严重程度分布</div>`;
    html += `<div class="bar-chart">`;
    for (let s = 1; s <= 5; s++) {
      const c = sevCounts[s] || 0;
      const pct = sevTotal > 0 ? (c / sevTotal * 100).toFixed(0) : 0;
      html += `<div class="bar-row"><span class="bar-label">${LABELS.sev[s]}</span><div class="bar-track"><div class="bar-fill" style="width:${c / maxSev * 100}%;background:${LABELS.sevColor[s]}"></div></div><span class="bar-count">${c}<small class="bar-pct">${sevTotal > 0 ? ' (' + pct + '%)' : ''}</small></span></div>`;
    }
    html += `</div>`;

    const locCounts = {};
    yearMigraines.forEach(m => (m.locations || []).forEach(l => { locCounts[l] = (locCounts[l] || 0) + 1; }));
    const maxLoc = Math.max(...Object.values(locCounts), 1);
    html += `<div class="stat-sub-title" style="margin-top:20px">疼痛部位分布</div><div class="bar-chart">`;
    Object.entries(locCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      const pct = sevTotal > 0 ? (v / sevTotal * 100).toFixed(0) : 0;
      html += `<div class="bar-row"><span class="bar-label">${LABELS.loc[k] || k}</span><div class="bar-track"><div class="bar-fill" style="width:${v / maxLoc * 100}%"></div></div><span class="bar-count">${v}<small class="bar-pct">${sevTotal > 0 ? ' (' + pct + '%)' : ''}</small></span></div>`;
    });
    html += `</div>`;

    const trigCounts = {};
    yearMigraines.forEach(m => (m.triggers || []).forEach(t => { trigCounts[t] = (trigCounts[t] || 0) + 1; }));
    const maxTrig = Math.max(...Object.values(trigCounts), 1);
    const trigSorted = Object.entries(trigCounts).sort((a, b) => b[1] - a[1]);
    html += `<div class="stat-sub-title" style="margin-top:20px">常见诱因</div><div class="bar-chart">`;
    trigSorted.forEach(([k, v], i) => {
      const pct = sevTotal > 0 ? (v / sevTotal * 100).toFixed(0) : 0;
      const ratio = trigSorted.length > 1 ? i / (trigSorted.length - 1) : 0;
      const opacity = 1 - ratio * 0.65;
      html += `<div class="bar-row"><span class="bar-label">${LABELS.trigger[k] || k}</span><div class="bar-track"><div class="bar-fill" style="width:${v / maxTrig * 100}%;background:rgba(124,58,237,${opacity})"></div></div><span class="bar-count">${v}<small class="bar-pct">${sevTotal > 0 ? ' (' + pct + '%)' : ''}</small></span></div>`;
    });
    html += `</div></div></div>`;
  }

  // ===== 年度变化对比 =====
  if (migraines.length) {
    const allDataYears = [...new Set(migraines.map(m => m.startDate.slice(0, 4)))].sort();
    if (allDataYears.length > 1) {
      if (!statsCompareYears.length) statsCompareYears = allDataYears.slice();
      const selYears = statsCompareYears.filter(y => allDataYears.includes(y)).sort();
      const yearColors = ['#7C3AED', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE'];

      html += `<div class="stat-section" id="sec-compare">`;
      html += `<div class="stat-section-header" onclick="toggleStatSection('sec-compare')"><h3 style="margin:0">年度变化对比</h3><svg class="collapse-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>`;
      html += `<div class="stat-section-body">`;
      html += `<div class="compare-year-picker"><span class="compare-year-hint">选择对比年份（至少2个）：</span><div class="compare-year-chips">`;
      allDataYears.forEach(y => {
        const active = selYears.includes(y) ? ' active' : '';
        html += `<button class="compare-year-chip${active}" onclick="toggleCompareYear('${y}')">${y}</button>`;
      });
      html += `</div></div>`;

      if (selYears.length >= 2) {
        // 1) 发作次数
        const countByYear = {};
        selYears.forEach(y => { countByYear[y] = migraines.filter(m => m.startDate.startsWith(y)).length; });
        const maxCnt = Math.max(...Object.values(countByYear));
        html += `<div class="stat-sub-title">发作次数</div><div class="bar-chart">`;
        selYears.forEach((y, i) => {
          const c = countByYear[y];
          const color = yearColors[i % yearColors.length];
          html += `<div class="bar-row"><span class="bar-label">${y}</span><div class="bar-track"><div class="bar-fill" style="width:${c / maxCnt * 100}%;background:${color}"></div></div><span class="bar-count">${c}次</span></div>`;
        });
        html += `</div>`;

        // 2) 严重程度分布
        html += `<div class="stat-sub-title" style="margin-top:20px">严重程度分布</div>`;
        html += `<div class="compare-table"><div class="compare-header"><div class="compare-cell label-cell"></div>`;
        selYears.forEach(y => { html += `<div class="compare-cell">${y}</div>`; });
        html += `</div>`;
        for (let s = 1; s <= 5; s++) {
          html += `<div class="compare-row"><div class="compare-cell label-cell">${LABELS.sev[s]}</div>`;
          selYears.forEach(y => {
            const ym = migraines.filter(m => m.startDate.startsWith(y));
            const c = ym.filter(m => m.severity === s).length;
            const pct = ym.length > 0 ? (c / ym.length * 100).toFixed(0) : 0;
            html += `<div class="compare-cell"><span class="compare-val">${c}</span><small class="compare-pct">${pct}%</small></div>`;
          });
          html += `</div>`;
        }
        html += `</div>`;

        // 3) 疼痛部位分布
        const selMigraines = migraines.filter(m => selYears.some(y => m.startDate.startsWith(y)));
        const allLocs = new Set();
        selMigraines.forEach(m => (m.locations || []).forEach(l => allLocs.add(l)));
        if (allLocs.size) {
          html += `<div class="stat-sub-title" style="margin-top:20px">疼痛部位分布</div>`;
          html += `<div class="compare-table"><div class="compare-header"><div class="compare-cell label-cell"></div>`;
          selYears.forEach(y => { html += `<div class="compare-cell">${y}</div>`; });
          html += `</div>`;
          [...allLocs].forEach(loc => {
            html += `<div class="compare-row"><div class="compare-cell label-cell">${LABELS.loc[loc] || loc}</div>`;
            selYears.forEach(y => {
              const ym = migraines.filter(m => m.startDate.startsWith(y));
              const c = ym.filter(m => (m.locations || []).includes(loc)).length;
              const pct = ym.length > 0 ? (c / ym.length * 100).toFixed(0) : 0;
              html += `<div class="compare-cell"><span class="compare-val">${c}</span><small class="compare-pct">${pct}%</small></div>`;
            });
            html += `</div>`;
          });
          html += `</div>`;
        }

        // 4) 常见诱因
        const allTrigs = new Set();
        selMigraines.forEach(m => (m.triggers || []).forEach(t => allTrigs.add(t)));
        if (allTrigs.size) {
          html += `<div class="stat-sub-title" style="margin-top:20px">常见诱因</div>`;
          html += `<div class="compare-table"><div class="compare-header"><div class="compare-cell label-cell"></div>`;
          selYears.forEach(y => { html += `<div class="compare-cell">${y}</div>`; });
          html += `</div>`;
          const trigTotals = {};
          [...allTrigs].forEach(t => { trigTotals[t] = selMigraines.filter(m => (m.triggers || []).includes(t)).length; });
          [...allTrigs].sort((a, b) => trigTotals[b] - trigTotals[a]).forEach(trig => {
            html += `<div class="compare-row"><div class="compare-cell label-cell">${LABELS.trigger[trig] || trig}</div>`;
            selYears.forEach(y => {
              const ym = migraines.filter(m => m.startDate.startsWith(y));
              const c = ym.filter(m => (m.triggers || []).includes(trig)).length;
              const pct = ym.length > 0 ? (c / ym.length * 100).toFixed(0) : 0;
              html += `<div class="compare-cell"><span class="compare-val">${c}</span><small class="compare-pct">${pct}%</small></div>`;
            });
            html += `</div>`;
          });
          html += `</div>`;
        }
      }

      html += `</div></div>`;
    }
  }

  // ===== 关联分析 =====
  if (migraines.length) {
    const relCurYear = new Date().getFullYear();
    if (!statsRelYear) statsRelYear = String(relCurYear);
    const relMigraines = migraines.filter(m => m.startDate.startsWith(statsRelYear));

    html += `<div class="stat-section" id="sec-relation">`;
    html += `<div class="stat-section-header" onclick="toggleStatSection('sec-relation')"><div class="trend-year-row" style="flex:1;margin-bottom:0"><h3 style="margin:0">关联分析</h3><div class="trend-year-right"><select class="year-select" onclick="event.stopPropagation()" onchange="selectStatsRelYear(this)">${yearOptions(statsRelYear, getYearRange())}</select></div></div><svg class="collapse-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>`;
    html += `<div class="stat-section-body">`;

    // 1) 星期几分布
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    relMigraines.forEach(m => {
      const d = new Date(m.startDate + 'T00:00:00');
      dowCounts[d.getDay()]++;
    });
    const dowOrder = [1, 2, 3, 4, 5, 6, 0];
    const maxDow = Math.max(...dowCounts);
    html += `<div class="stat-sub-title">发作与星期的关系</div>`;
    html += `<div class="trend-chart-area"><div class="trend-chart">`;
    dowOrder.forEach(di => {
      const c = dowCounts[di];
      const h = maxDow > 0 ? (c / maxDow * 70) : 0;
      const barH = c > 0 ? Math.max(h, 4) : 0;
      html += `<div class="trend-col"><span class="trend-bar-count">${c || ''}</span><div class="trend-bar" style="height:${barH}px"></div></div>`;
    });
    html += `</div><div class="trend-labels">`;
    dowOrder.forEach(di => {
      html += `<div class="trend-bar-label">${weekNames[di]}</div>`;
    });
    html += `</div></div>`;

    // 2) 天气关系
    const weatherCounts = {};
    relMigraines.forEach(m => (m.weatherTags || []).forEach(w => { weatherCounts[w] = (weatherCounts[w] || 0) + 1; }));
    const weatherSorted = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1]);
    if (weatherSorted.length) {
      const maxW = weatherSorted[0][1];
      html += `<div class="stat-sub-title" style="margin-top:20px">发作与天气的关系</div><div class="bar-chart">`;
      weatherSorted.forEach(([k, v], i) => {
        const pct = relMigraines.length > 0 ? (v / relMigraines.length * 100).toFixed(0) : 0;
        const ratio = weatherSorted.length > 1 ? i / (weatherSorted.length - 1) : 0;
        const opacity = 1 - ratio * 0.6;
        html += `<div class="bar-row"><span class="bar-label">${LABELS.weather[k] || k}</span><div class="bar-track"><div class="bar-fill" style="width:${v / maxW * 100}%;background:rgba(124,58,237,${opacity})"></div></div><span class="bar-count">${v}<small class="bar-pct"> (${pct}%)</small></span></div>`;
      });
      html += `</div>`;
    }

    // 3) 生理期关系
    if (periods.length) {
      const relCats = { during: 0, before7: 0, after7: 0, other: 0 };
      relMigraines.forEach(m => {
        const rel = getPeriodRelation(m.startDate);
        if (!rel) { relCats.other++; return; }
        if (rel.startsWith('经期第')) relCats.during++;
        else if (rel.startsWith('经期前')) {
          const days = parseInt(rel.match(/\d+/));
          if (days <= 7) relCats.before7++; else relCats.other++;
        } else if (rel.startsWith('经期后')) {
          const days = parseInt(rel.match(/\d+/));
          if (days <= 7) relCats.after7++; else relCats.other++;
        } else relCats.other++;
      });
      const relLabels = [
        ['during', '经期中', 'var(--pink)'],
        ['before7', '经期前7天内', '#F9A8D4'],
        ['after7', '经期后7天内', '#FDBA74'],
        ['other', '其他时间', '#D1D5DB']
      ];
      const maxRel = Math.max(...Object.values(relCats), 1);
      html += `<div class="stat-sub-title" style="margin-top:20px">发作与生理期的关系</div><div class="bar-chart">`;
      relLabels.forEach(([key, label, color]) => {
        const c = relCats[key];
        const pct = relMigraines.length > 0 ? (c / relMigraines.length * 100).toFixed(0) : 0;
        html += `<div class="bar-row"><span class="bar-label">${label}</span><div class="bar-track"><div class="bar-fill" style="width:${c / maxRel * 100}%;background:${color}"></div></div><span class="bar-count">${c}<small class="bar-pct"> (${pct}%)</small></span></div>`;
      });
      html += `</div>`;
    }

    // 4) 持续时间统计
    const durations = relMigraines.filter(m => m.durationHours && m.durationHours > 0).map(m => m.durationHours);
    if (durations.length) {
      const avgDur = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
      const minDur = Math.min(...durations).toFixed(1);
      const maxDur = Math.max(...durations).toFixed(1);
      const durBuckets = [
        { label: '<4h', min: 0, max: 4, count: 0 },
        { label: '4-8h', min: 4, max: 8, count: 0 },
        { label: '8-12h', min: 8, max: 12, count: 0 },
        { label: '12-24h', min: 12, max: 24, count: 0 },
        { label: '24-48h', min: 24, max: 48, count: 0 },
        { label: '>48h', min: 48, max: Infinity, count: 0 },
      ];
      durations.forEach(d => {
        for (const b of durBuckets) { if (d >= b.min && d < b.max) { b.count++; break; } }
      });
      const maxBucket = Math.max(...durBuckets.map(b => b.count));
      html += `<div class="stat-sub-title" style="margin-top:20px">发作持续时间</div>`;
      html += `<div style="display:flex;gap:12px;margin-bottom:14px">
        <div class="stat-card" style="flex:1"><div class="stat-value">${avgDur}</div><div class="stat-label">平均(小时)</div></div>
        <div class="stat-card" style="flex:1"><div class="stat-value">${minDur}</div><div class="stat-label">最短(小时)</div></div>
        <div class="stat-card" style="flex:1"><div class="stat-value">${maxDur}</div><div class="stat-label">最长(小时)</div></div>
      </div>`;
      html += `<div class="bar-chart">`;
      durBuckets.forEach(b => {
        const pct = durations.length > 0 ? (b.count / durations.length * 100).toFixed(0) : 0;
        html += `<div class="bar-row"><span class="bar-label">${b.label}</span><div class="bar-track"><div class="bar-fill" style="width:${b.count / maxBucket * 100}%"></div></div><span class="bar-count">${b.count}<small class="bar-pct"> (${pct}%)</small></span></div>`;
      });
      html += `</div>`;
    }

    html += `</div></div>`;
  }

  const sortedPeriods = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const periodsWithCycle = sortedPeriods.filter(p => p.cycleLength && p.cycleLength > 0 && p.cycleLength < 60);
  if (periodsWithCycle.length) {
    const curYear = new Date().getFullYear();
    if (!statsPeriodYear) statsPeriodYear = String(curYear);
    const yearPeriodsAll = periodsWithCycle.filter(p => p.startDate.startsWith(statsPeriodYear));
    const yearCycles = yearPeriodsAll.map(p => p.cycleLength);
    const avgCycle = yearCycles.length ? (yearCycles.reduce((a, b) => a + b, 0) / yearCycles.length).toFixed(1) : '-';
    const rangeText = yearCycles.length ? `${Math.min(...yearCycles)}-${Math.max(...yearCycles)}` : '-';

    html += `<div class="stat-section" id="sec-period-yearly">`;
    html += `<div class="stat-section-header" onclick="toggleStatSection('sec-period-yearly')"><div class="trend-year-row" style="flex:1;margin-bottom:0"><h3 style="margin:0">经期周期年度统计</h3><div class="trend-year-right"><select class="year-select" onclick="event.stopPropagation()" onchange="selectStatsPeriodYear(this)">${yearOptions(statsPeriodYear, getYearRange())}</select></div></div><svg class="collapse-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>`;
    html += `<div class="stat-section-body">`;
    html += `<div style="display:flex;gap:12px;margin-bottom:14px;margin-top:14px">
        <div class="stat-card" style="flex:1"><div class="stat-value pink">${avgCycle}</div><div class="stat-label">平均周期(天)</div></div>
        <div class="stat-card" style="flex:1"><div class="stat-value pink">${rangeText}</div><div class="stat-label">周期范围(天)</div></div>
      </div>`;
    if (yearPeriodsAll.length) {
      html += `<div class="bar-chart">`;
      yearPeriodsAll.forEach(p => {
        html += `<div class="bar-row"><span class="bar-label">${fmtDateShort(p.startDate)}</span><div class="bar-track"><div class="bar-fill pink" style="width:${Math.min(p.cycleLength / 50 * 100, 100)}%"><span class="bar-val">${p.cycleLength}</span></div></div><span class="bar-count">${p.cycleLength}天</span></div>`;
      });
      html += `</div>`;
    } else {
      html += `<div class="empty-state" style="padding:16px">该年度暂无经期周期数据</div>`;
    }
    html += `</div></div>`;
  }

  document.getElementById('stats-content').innerHTML = html;
}

// ===== SETTINGS =====
function exportData() {
  const exportObj = {
    version: 2,
    exportDate: new Date().toISOString(),
    user: currentUser,
    records: getData(),
    customOptions: JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}'),
    removedDefaults: JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '{}')
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health_data_${currentUser}_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('migraine_last_export', Date.now().toString());
  showToast('数据已导出（含全部记录和自定义选项）');
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      let records, customOptions, removedDefaults;

      if (Array.isArray(raw)) {
        records = raw;
      } else if (raw.version && raw.records) {
        records = raw.records || [];
        customOptions = raw.customOptions;
        removedDefaults = raw.removedDefaults;
      } else {
        throw new Error('unrecognized format');
      }

      const existing = getData();
      const existingIds = new Set(existing.map(r => r.id));
      let added = 0;
      records.forEach(r => { if (r.id && !existingIds.has(r.id)) { existing.push(r); added++; } });
      saveData(existing);

      if (customOptions && typeof customOptions === 'object') {
        const cur = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}');
        for (const [group, items] of Object.entries(customOptions)) {
          if (!Array.isArray(items)) continue;
          if (!cur[group]) cur[group] = [];
          items.forEach(v => { if (!cur[group].includes(v)) cur[group].push(v); });
        }
        localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(cur));
      }

      if (removedDefaults && typeof removedDefaults === 'object') {
        const cur = JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '{}');
        for (const [group, items] of Object.entries(removedDefaults)) {
          if (!Array.isArray(items)) continue;
          if (!cur[group]) cur[group] = [];
          items.forEach(v => { if (!cur[group].includes(v)) cur[group].push(v); });
        }
        localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(cur));
      }

      const parts = [`已导入 ${added} 条新记录`];
      if (customOptions) parts.push('自定义选项已合并');
      showToast(parts.join('，'));
      refreshCurrentView();
    } catch { showToast('导入失败，请检查文件格式'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}
function confirmClearData() {
  if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    if (confirm('再次确认：真的要删除所有记录吗？')) {
      localStorage.removeItem(STORAGE_KEY);
      showToast('数据已清除');
      closeModal('modal-settings');
      refreshCurrentView();
    }
  }
}

// Historical data removed for privacy — use "导入数据" to restore from backup JSON
function loadHistoricalData() {}

// ===== INIT =====
function updateAppTitle() {
  const title = document.getElementById('app-title');
  if (!title) return;
  if (typeof _fbUser !== 'undefined' && _fbUser) {
    const name = _fbUser.displayName || _fbUser.email.split('@')[0];
    title.textContent = name + ' 的健康日记';
  } else if (currentUser && currentUser !== 'default' && currentUser !== 'local') {
    title.textContent = currentUser + ' 的健康日记';
  } else {
    title.textContent = '健康日记';
  }
}

function startLocalMode() {
  closeModal('modal-welcome');
  const name = prompt('请输入你的名字（用于标题显示）：');
  if (name && name.trim()) {
    currentUser = name.trim();
  } else {
    currentUser = 'local';
  }
  initUserKeys();
  registerUser(currentUser);
  localStorage.setItem('migraine_local_user', currentUser);
  updateAppTitle();
  renderDashboard();
}

function init() {
  loadTheme();

  // Determine user identity
  const urlUser = new URLSearchParams(window.location.search).get('user');
  const savedLocal = localStorage.getItem('migraine_local_user');

  if (urlUser) {
    currentUser = urlUser;
  } else if (savedLocal) {
    currentUser = savedLocal;
  } else {
    currentUser = 'local';
  }

  initUserKeys();
  registerUser(currentUser);

  // Migrate legacy unprefixed data
  const legacyData = localStorage.getItem('migraine_tracker_data');
  if (legacyData && !localStorage.getItem(STORAGE_KEY) && STORAGE_KEY !== 'migraine_tracker_data') {
    localStorage.setItem(STORAGE_KEY, legacyData);
    const legacyCO = localStorage.getItem('migraine_tracker_custom_options');
    if (legacyCO) localStorage.setItem(CUSTOM_OPTIONS_KEY, legacyCO);
    const legacyRD = localStorage.getItem('migraine_tracker_removed_defaults');
    if (legacyRD) localStorage.setItem(REMOVED_DEFAULTS_KEY, legacyRD);
  }

  // Migrate old named-user data to current user
  const users = getAllUsers();
  if (currentUser === 'local' && !getData().length) {
    for (const u of users) {
      if (u === 'local' || u === 'default') continue;
      const uData = localStorage.getItem(u + '_migraine_tracker_data');
      if (uData) {
        localStorage.setItem(STORAGE_KEY, uData);
        const uCO = localStorage.getItem(u + '_migraine_tracker_custom_options');
        if (uCO) localStorage.setItem(CUSTOM_OPTIONS_KEY, uCO);
        const uRD = localStorage.getItem(u + '_migraine_tracker_removed_defaults');
        if (uRD) localStorage.setItem(REMOVED_DEFAULTS_KEY, uRD);
        currentUser = u;
        initUserKeys();
        localStorage.setItem('migraine_local_user', currentUser);
        break;
      }
    }
  }

  updateAppTitle();
  loadHistoricalData();
  migrateData();
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  setupEventListeners();
  renderDashboard();
  checkBackupReminder();

  if (typeof initFirebase === 'function') initFirebase();
  if (typeof updateCloudUI === 'function') setTimeout(updateCloudUI, 100);

  // Show welcome modal for first-time users (no local data, not logged in)
  if (!savedLocal && !urlUser && !getData().length) {
    setTimeout(() => {
      if (typeof _fbUser === 'undefined' || !_fbUser) {
        openModal('modal-welcome');
      }
    }, 300);
  }
}

function setupEventListeners() {
  if (setupEventListeners._done) return;
  setupEventListeners._done = true;

  document.querySelectorAll('.chip-group:not(.single-select)').forEach(group => {
    group.addEventListener('click', e => {
      if (e.target.closest('.chip-remove')) {
        e.preventDefault();
        e.stopPropagation();
        const rm = e.target.closest('.chip-remove');
        const gid = rm.dataset.group;
        const label = rm.dataset.label;
        const chipEl = rm.closest('.chip');
        if (rm.dataset.default === '1') {
          const chipText = chipEl.querySelector('.chip-text') ? chipEl.querySelector('.chip-text').textContent.trim() : label;
          if (!confirm(`确定永久删除默认选项「${chipText}」吗？`)) return;
          addRemovedDefault(gid, label);
          chipEl.remove();
          showToast(`已删除「${chipText}」`);
        } else {
          removeCustomOption(gid, label);
          renderCustomChips(gid);
        }
        return;
      }
      if (e.target.closest('.chip-add-other')) {
        const gid = e.target.closest('.chip-add-other').dataset.for;
        const row = document.querySelector(`.custom-input-row[data-for="${gid}"]`);
        if (row) { row.classList.toggle('hidden'); if (!row.classList.contains('hidden')) row.querySelector('input').focus(); }
        return;
      }
      const chip = e.target.closest('.chip');
      if (chip) chip.classList.toggle('active');
    });
  });

  document.querySelectorAll('.custom-input-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = btn.dataset.for;
      const input = document.querySelector(`.custom-input-row[data-for="${gid}"] input`);
      if (input) addCustomChip(gid, input.value);
    });
  });
  document.querySelectorAll('.custom-input-row input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const gid = input.closest('.custom-input-row').dataset.for;
        addCustomChip(gid, input.value);
      }
    });
  });

  document.querySelectorAll('.chip-group.single-select').forEach(group => {
    group.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      if (group.id === 'm-med-taken') {
        const details = document.getElementById('m-med-details');
        if (chip.dataset.value === 'yes') {
          details.classList.remove('hidden');
          if (!document.querySelectorAll('#m-med-list .med-entry').length) addMedEntry();
        } else {
          details.classList.add('hidden');
        }
      }
    });
  });

  document.getElementById('m-severity').addEventListener('click', e => {
    const btn = e.target.closest('.severity-btn');
    if (!btn) return;
    document.querySelectorAll('#m-severity .severity-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  document.getElementById('m-start-dt').addEventListener('change', calcDuration);
  document.getElementById('m-end-dt').addEventListener('change', calcDuration);

  const pStart = document.getElementById('p-start');
  const pEnd = document.getElementById('p-end');
  const pDur = document.getElementById('p-duration');
  function autoCalcPeriodDuration() {
    if (pStart.value && pEnd.value) {
      const d = daysBetween(pStart.value, pEnd.value) + 1;
      if (d > 0) pDur.value = d;
    }
  }
  pStart.addEventListener('change', autoCalcPeriodDuration);
  pEnd.addEventListener('change', autoCalcPeriodDuration);
}

function checkBackupReminder() {
  if (!getData().length) return;
  const last = parseInt(localStorage.getItem('migraine_last_export') || '0');
  const daysSince = (Date.now() - last) / 86400000;
  if (daysSince > 30) {
    setTimeout(() => {
      showToast('已超过30天未备份，建议在设置中导出数据');
    }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', init);
