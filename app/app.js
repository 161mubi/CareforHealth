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
  document.getElementById('current-user-name').textContent = name;
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
}
function removeCustomOption(groupId, label) {
  const all = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}');
  if (all[groupId]) all[groupId] = all[groupId].filter(v => v !== label);
  localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(all));
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
    chip.innerHTML = `<span class="chip-text">${label}</span><span class="chip-remove" data-group="${groupId}" data-label="${label}">&times;</span>`;
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
function saveData(records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function getMigraines() { return getData().filter(r => r.type === 'migraine').sort((a, b) => b.startDate.localeCompare(a.startDate)); }
function getPeriods() { return getData().filter(r => r.type === 'period').sort((a, b) => b.startDate.localeCompare(a.startDate)); }
function addRecord(rec) { const d = getData(); d.push(rec); saveData(d); }
function updateRecord(rec) { const d = getData(); const i = d.findIndex(r => r.id === rec.id); if (i >= 0) d[i] = rec; saveData(d); }
function deleteRecord(id) { saveData(getData().filter(r => r.id !== id)); }
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
  clearChips('m-med-taken'); clearChips('m-med-effective'); clearSeverity();
  document.getElementById('m-med-details').classList.add('hidden');
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
    if (editRecord.medication) {
      setSingleChip('m-med-taken', 'yes');
      document.getElementById('m-med-details').classList.remove('hidden');
      document.getElementById('m-med-name').value = editRecord.medication.name || '';
      document.getElementById('m-med-dosage').value = editRecord.medication.dosage || '';
      document.getElementById('m-med-time').value = editRecord.medication.time || '';
      if (editRecord.medication.effective) setSingleChip('m-med-effective', editRecord.medication.effective);
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
function showSettings() { openModal('modal-settings'); }

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
  e.preventDefault();
  const severity = getSeverity();
  if (!severity) { showToast('请选择严重程度'); return; }
  const locations = getChips('m-locations');
  if (!locations.length) { showToast('请选择疼痛部位'); return; }

  const startDtVal = document.getElementById('m-start-dt').value;
  const endDtVal = document.getElementById('m-end-dt').value;
  const startDate = startDtVal.slice(0, 10);
  const startTime = startDtVal.slice(11, 16);
  const endDate = endDtVal ? endDtVal.slice(0, 10) : '';
  const endTime = endDtVal ? endDtVal.slice(11, 16) : '';
  const durationHours = parseFloat(document.getElementById('m-duration-val').value) || null;

  let medication = null;
  if (getSingleChip('m-med-taken') === 'yes') {
    medication = {
      name: document.getElementById('m-med-name').value.trim(),
      dosage: document.getElementById('m-med-dosage').value.trim(),
      time: document.getElementById('m-med-time').value,
      effective: getSingleChip('m-med-effective'),
    };
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
        <span class="card-date">${dateDisplay}</span>
        <span class="card-severity" style="background:${sevBg}20;color:${sevTxt}">${sevLabel}</span>
      </div>
      <div class="card-body">${locs}${relation ? ' · ' + relation : ''}</div>
      ${(r.triggers && r.triggers.length) ? `<div class="card-tags">${r.triggers.map(t => `<span class="card-tag">${LABELS.trigger[t] || t}</span>`).join('')}</div>` : ''}
    </div>`;
  } else {
    const dur = r.duration ? `${r.duration}天` : '';
    const cycle = r.cycleLength ? `周期${r.cycleLength}天` : '';
    return `<div class="record-card" onclick='showDetail(${JSON.stringify(r.id)})'>
      <div class="card-header">
        <span class="card-badge period"></span>
        <span class="card-date">${fmtDate(r.startDate)} ${fmtWeekday(r.startDate)}</span>
        <span class="card-severity" style="background:#FCE7F3;color:#EC4899">经期</span>
      </div>
      <div class="card-body">${[dur, cycle].filter(Boolean).join(' · ') || '经期开始'}</div>
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
    if (rec.medication) {
      const parts = [rec.medication.name, rec.medication.dosage, rec.medication.time ? `${rec.medication.time}服用` : ''].filter(Boolean);
      if (rec.medication.effective) parts.push(LABELS.medEffect[rec.medication.effective] || rec.medication.effective);
      medHtml = `<div class="detail-row"><span class="detail-label">止痛药</span><span class="detail-value">${parts.join('，')}</span></div>`;
    }
    body.innerHTML = `
      <div class="detail-row"><span class="detail-label">开始</span><span class="detail-value">${fmtDate(rec.startDate)} ${fmtWeekday(rec.startDate)} ${rec.startTime || ''}</span></div>
      ${rec.endDate ? `<div class="detail-row"><span class="detail-label">结束</span><span class="detail-value">${fmtDate(rec.endDate)} ${rec.endTime || ''}</span></div>` : ''}
      ${rec.durationHours ? `<div class="detail-row"><span class="detail-label">持续</span><span class="detail-value">${rec.durationHours} 小时</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">部位</span><span class="detail-value">${labelsFor(LABELS.loc, rec.locations)}</span></div>
      <div class="detail-row"><span class="detail-label">程度</span><span class="detail-value">${LABELS.sev[rec.severity] || ''}</span></div>
      ${relation ? `<div class="detail-row"><span class="detail-label">经期关系</span><span class="detail-value">${relation}</span></div>` : ''}
      ${rec.weatherTags?.length ? `<div class="detail-row"><span class="detail-label">天气</span><span class="detail-value">${labelsFor(LABELS.weather, rec.weatherTags)}</span></div>` : ''}
      ${rec.sleepHours != null ? `<div class="detail-row"><span class="detail-label">睡眠</span><span class="detail-value">${rec.sleepHours} 小时</span></div>` : ''}
      ${rec.diet24h ? `<div class="detail-row"><span class="detail-label">饮食</span><span class="detail-value">${rec.diet24h}</span></div>` : ''}
      ${rec.triggers?.length ? `<div class="detail-row"><span class="detail-label">诱因</span><span class="detail-value">${labelsFor(LABELS.trigger, rec.triggers)}</span></div>` : ''}
      ${rec.symptoms?.length ? `<div class="detail-row"><span class="detail-label">伴随症状</span><span class="detail-value">${labelsFor(LABELS.symptom, rec.symptoms)}</span></div>` : ''}
      ${rec.prodromal?.length ? `<div class="detail-row"><span class="detail-label">前驱症状</span><span class="detail-value">${labelsFor(LABELS.prodromal, rec.prodromal)}</span></div>` : ''}
      ${rec.relief?.length ? `<div class="detail-row"><span class="detail-label">缓解方法</span><span class="detail-value">${labelsFor(LABELS.relief, rec.relief)}</span></div>` : ''}
      ${medHtml}
      ${rec.postSymptoms ? `<div class="detail-row"><span class="detail-label">头痛后</span><span class="detail-value">${rec.postSymptoms}${rec.postSymptomsDuration ? `（持续${rec.postSymptomsDuration}h）` : ''}</span></div>` : ''}
      ${rec.notes ? `<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${rec.notes}</span></div>` : ''}
    `;
    editBtn.onclick = () => { closeModal('modal-detail'); showRecordMigraine(rec); };
  } else {
    title.textContent = '经期详情';
    body.innerHTML = `
      <div class="detail-row"><span class="detail-label">开始日期</span><span class="detail-value">${fmtDate(rec.startDate)}</span></div>
      ${rec.endDate ? `<div class="detail-row"><span class="detail-label">结束日期</span><span class="detail-value">${fmtDate(rec.endDate)}</span></div>` : ''}
      ${rec.duration ? `<div class="detail-row"><span class="detail-label">持续天数</span><span class="detail-value">${rec.duration}天</span></div>` : ''}
      ${rec.cycleLength ? `<div class="detail-row"><span class="detail-label">周期天数</span><span class="detail-value">${rec.cycleLength}天</span></div>` : ''}
      ${rec.padUsage ? `<div class="detail-row"><span class="detail-label">卫生巾</span><span class="detail-value">每日: ${rec.padUsage}</span></div>` : ''}
      ${rec.notes ? `<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${rec.notes}</span></div>` : ''}
    `;
    editBtn.onclick = () => { closeModal('modal-detail'); showRecordPeriod(rec); };
  }
  deleteBtn.onclick = () => {
    if (confirm('确定删除这条记录吗？')) {
      deleteRecord(rec.id);
      closeModal('modal-detail');
      showToast('已删除');
      refreshCurrentView();
    }
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
  const container = document.getElementById('history-list');
  let records;
  if (historyFilter === 'migraine') records = getMigraines().map(r => ({ ...r, sortDate: r.startDate }));
  else if (historyFilter === 'period') records = getPeriods().map(r => ({ ...r, sortDate: r.startDate }));
  else records = [
    ...getMigraines().map(r => ({ ...r, sortDate: r.startDate })),
    ...getPeriods().map(r => ({ ...r, sortDate: r.startDate })),
  ];
  records.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  if (!records.length) { container.innerHTML = '<div class="empty-state">暂无记录</div>'; return; }
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
function filterHistory(filter, btn) {
  historyFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory();
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

    html += `<div class="stat-section">`;
    html += `<div class="trend-year-row"><h3 style="margin:0">偏头痛年度统计</h3><div class="trend-year-right"><select class="year-select" onchange="selectStatsYear(this)">`;
    for (let y = 2024; y <= 2100; y++) {
      html += `<option value="${y}"${String(y) === statsYear ? ' selected' : ''}>${y}年</option>`;
    }
    html += `</select><span class="trend-year-total">共 <strong>${yearTotal}</strong> 次</span></div></div>`;

    html += `<div class="stat-sub-title">月度发作趋势</div>`;
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
    html += `</div></div>`;
  }

  // ===== 年度变化对比 =====
  if (migraines.length) {
    const allDataYears = [...new Set(migraines.map(m => m.startDate.slice(0, 4)))].sort();
    if (allDataYears.length > 1) {
      if (!statsCompareYears.length) statsCompareYears = allDataYears.slice();
      const selYears = statsCompareYears.filter(y => allDataYears.includes(y)).sort();
      const yearColors = ['#7C3AED', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE'];

      html += `<div class="stat-section"><h3>年度变化对比</h3>`;
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

      html += `</div>`;
    }
  }

  // ===== 关联分析 =====
  if (migraines.length) {
    const relCurYear = new Date().getFullYear();
    if (!statsRelYear) statsRelYear = String(relCurYear);
    const relMigraines = migraines.filter(m => m.startDate.startsWith(statsRelYear));

    html += `<div class="stat-section">`;
    html += `<div class="trend-year-row"><h3 style="margin:0">关联分析</h3><div class="trend-year-right"><select class="year-select" onchange="selectStatsRelYear(this)">`;
    for (let y = 2024; y <= 2100; y++) {
      html += `<option value="${y}"${String(y) === statsRelYear ? ' selected' : ''}>${y}年</option>`;
    }
    html += `</select></div></div>`;

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

    html += `</div>`;
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

    html += `<div class="stat-section">`;
    html += `<div class="trend-year-row"><h3 style="margin:0">经期周期年度统计</h3><div class="trend-year-right"><select class="year-select" onchange="selectStatsPeriodYear(this)">`;
    for (let y = 2024; y <= 2100; y++) {
      html += `<option value="${y}"${String(y) === statsPeriodYear ? ' selected' : ''}>${y}年</option>`;
    }
    html += `</select></div></div>`;
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
    html += `</div>`;
  }

  document.getElementById('stats-content').innerHTML = html;
}

// ===== SETTINGS =====
function exportData() {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `health_data_${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出');
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error();
      const existing = getData();
      const existingIds = new Set(existing.map(r => r.id));
      let added = 0;
      imported.forEach(r => { if (!existingIds.has(r.id)) { existing.push(r); added++; } });
      saveData(existing);
      showToast(`已导入 ${added} 条新记录`);
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

// ===== HISTORICAL DATA =====
function loadHistoricalData() {
  if (getData().length > 0) return;
  const records = [];
  // [startDate, locations[], severity, triggers[], relief[], symptoms[], prodromal[], notes]
  const hm = [
    ['2024-01-10',['left','top','right'],4,['period'],['sneeze'],['vomiting'],['chills','drowsy'],'生理期前期；乳房胀痛'],
    ['2024-01-26',[],1,[],[],[],'','肠胃炎'],
    ['2024-01-30',['left'],1,['weather'],['comb','sneeze','huoxiang'],[],[],'下雨天'],
    ['2024-02-02',['left'],3,['weather'],['sneeze','huoxiang'],[],[],'微雨天'],
    ['2024-02-16',['top','right'],3,['period','fatigue'],['sleep','huoxiang'],[],[],''],
    ['2024-02-21',[],1,['cold'],['comb','huoxiang'],[],['chills'],'感冒+冰箱除冰劳累受寒'],
    ['2024-03-01',['right'],3,[],['sneeze','huoxiang'],[],['head_foggy'],'前兆后发作'],
    ['2024-03-11',['left','top'],1,['fatigue','cold','period'],['sneeze','huoxiang','sleep'],[],[],'地铁空调低'],
    ['2024-03-27',[],5,['fatigue'],[],['vomiting'],[],'过度劳累；呕吐2-3次'],
    ['2024-04-01',[],1,['cold'],['sleep'],[],[],'前一天吹到风，中午自行缓解'],
    ['2024-04-07',['right'],3,['sleep','weather'],[],[],[],'极度乏困+下雨阴天+熬夜打电话'],
    ['2024-04-10',['right'],1,['period'],['sleep','comb','footbath','sneeze'],[],[],''],
    ['2024-04-18',['right'],1,['weather'],['footbath','comb','sneeze'],[],[],'阴天'],
    ['2024-05-02',[],4,['weather','fatigue'],['footbath','comb','sneeze','huoxiang'],['vomiting'],['drowsy','sneeze'],'下雨天/前一天去SZ劳累'],
    ['2024-05-16',['left'],2,['period','sleep'],[],[],[],'生理期第一天+中午没午休'],
    ['2024-05-21',['right'],1,['sleep','fatigue','weather'],['footbath','comb'],[],[],'5:30起床做PPT+下雨'],
    ['2024-05-25',['right','top','left'],1,[],['sleep'],[],[],''],
    ['2024-05-31',['right'],3,[],['footbath','massage','sneeze','hot_wash'],[],['drowsy'],''],
    ['2024-06-20',[],3,['fatigue','period'],['sleep'],[],[],'过度劳累+生理期将至'],
    ['2024-06-28',[],1,[],['sleep','music'],[],[],''],
    ['2024-07-12',['right'],3,[],['comb','sneeze','sun','sleep'],['vomiting'],[],'身体极虚'],
    ['2024-07-21',['left'],3,['sleep','fatigue'],['sleep'],[],['head_foggy'],'睡眠不规律+出去玩过度劳累'],
    ['2024-07-30',[],4,[],['sleep'],['vomiting'],[],'蹲大号后好转'],
    ['2024-08-02',['top'],1,[],[],[],[],'鼻敏感'],
    ['2024-08-12',['left'],1,[],['sleep'],[],[],''],
    ['2024-08-30',['right'],5,['period','sleep'],['huoxiang','footbath','comb','hot_wash','sleep'],['vomiting'],['drowsy'],'呕吐全吐；胃满'],
    ['2024-09-01',['right'],1,['emotion'],[],['appetite_loss'],[],'给妈妈打电话时哭泣'],
    ['2024-09-12',['top','right'],4,['period','smell'],['massage','sleep'],[],['drowsy','chills'],'生理期第二天+闻到香水味'],
    ['2024-09-18',['right'],3,['emotion'],['massage','hot_wash','huoxiang'],[],[],'聊天时情绪起伏太大'],
    ['2024-10-06',[],3,['sleep'],['sleep','massage'],[],[],'看悬疑动作电影致凌晨2点'],
    ['2024-10-10',['right','top'],2,['emotion','talking'],['huoxiang','hot_wash','sleep'],['nasal','diarrhea'],[],'毕业论文情绪崩溃大哭'],
    ['2024-10-12',['left','top'],2,['emotion'],['massage','huoxiang','sneeze'],[],[],'焦虑紧张'],
    ['2024-10-26',['right'],3,['period','fatigue'],['massage','huoxiang','sneeze','sleep'],[],[],'当天往返深圳做实验'],
    ['2024-10-30',['left'],3,[],['massage','hot_wash'],[],[],''],
    ['2024-11-25',['top'],1,['sleep','period'],['huoxiang'],[],[],'早起+晚睡+生理期'],
    ['2024-11-30',['right'],1,['fatigue','screen','cold'],['sleep'],[],[],'中午没休息+看微信读书+感冒'],
    ['2024-12-12',['left'],2,['sleep','screen'],['massage','footbath'],[],['head_swell'],'早起+看小视频过于专注'],
    ['2025-01-08',['top','right'],3,['screen'],['huoxiang','sleep'],[],['head_foggy'],'做组会PPT精力集中'],
    ['2025-03-01',['top','right'],3,['period','fatigue','talking'],['huoxiang','sleep','hot_wash'],[],[],''],
    ['2025-04-02',['right'],3,['period','talking'],['huoxiang','sleep','massage'],['nausea'],[],'吃饭聊天说话很多'],
    ['2025-04-05',['left','top'],2,[],['massage','sleep'],[],[],''],
    ['2025-04-22',['top'],3,['fatigue','screen'],['huoxiang','massage'],[],[],'看手机视频一下午'],
    ['2025-04-28',['left'],3,['screen'],['huoxiang'],[],[],'看电脑过于集中精力'],
    ['2025-05-22',['right','top'],3,[],['taichong','massage'],[],[],''],
    ['2025-05-24',['left','top'],3,['sleep','screen'],['massage','taichong','sleep'],[],[],'中午没休息+网购一直看手机'],
    ['2025-06-04',['top'],1,['period','sleep'],['taichong'],[],[],'生理期+组会早起做PPT'],
    ['2025-06-19',['top','right'],3,['sleep'],['sleep','massage','sneeze','huoxiang','hot_wash'],[],['runny_nose','chills'],'前一晚做梦没休息好'],
    ['2025-07-16',['right'],3,['sleep','screen'],['sneeze','hot_wash','huoxiang','sleep'],[],[],'前两天早起+电脑跑数据'],
    ['2025-07-18',['left'],3,['talking','screen'],['huoxiang','music','sleep'],[],[],'吃饭与人交谈说话太多'],
    ['2025-07-26',[],4,['weather'],['huoxiang','sleep'],['dizziness','vomiting'],[],'前一天淋雨'],
    ['2025-08-09',['top','right'],4,[],['footbath','comb','massage','sun'],['vomiting'],[],''],
    ['2025-08-29',['top','left'],3,['sleep','screen'],['huoxiang','sleep'],[],['sneeze','chills'],'多梦休息不足+看一天电脑'],
    ['2025-08-30',['right'],1,[],['massage','taichong'],[],[],'爬山+刮经络'],
    ['2025-09-11',['right'],3,[],['sun','sleep','music'],['vomiting'],['chills'],''],
    ['2025-09-18',['top'],1,['fatigue','screen'],['sleep','sun'],[],[],'非常疲惫+一直看手机'],
    ['2025-10-01',['top'],3,['screen'],['sleep'],[],['head_foggy'],'一边做实验一边听费脑播客'],
    ['2025-10-05',['top'],1,['screen'],['comb','taichong','sleep'],[],[],'周日一直看视频'],
    ['2025-10-29',['right','top'],3,['period','screen'],['sleep'],['vomiting'],['head_foggy'],'双11一直看手机购物'],
    ['2025-11-02',['left','top'],2,['fatigue'],[],[],[],'收拾新住处过于劳累'],
    ['2025-12-27',['right','top'],3,['period'],['taichong','sleep'],['vomiting'],['head_foggy'],'前一天喝水少/生理期将至'],
    ['2025-12-30',['right','top'],3,['period'],['comb','footbath','taichong','hot_wash'],[],[],'生理期第二天'],
    ['2026-01-20',['right','top'],2,['screen'],['hot_wash'],[],[],'处理MST数据过于专注且时间长'],
    ['2026-02-01',['right'],3,['period','fatigue'],['sleep','taichong','hot_wash'],['vomiting'],[],'生理期临近/前一天劳累'],
    ['2026-02-27',['right'],2,['emotion'],['hot_wash','footbath'],[],[],'答辩彩排紧张'],
    ['2026-03-13',['left'],3,[],['footbath','music','sleep','hot_wash'],['heavy_head'],[],''],
    ['2026-03-27',['top','right'],2,['fatigue','screen'],['sleep','taichong'],['nausea','heavy_head'],['drowsy','head_foggy'],'前两天做了两整天实验+MST数据分析过于专注'],
  ];
  hm.forEach((m, i) => {
    records.push({
      id: `hm${i}`, type: 'migraine',
      startDate: m[0], startTime: '18:00', endDate: '', endTime: '',
      durationHours: null,
      locations: m[1], severity: m[2],
      triggers: m[3], relief: m[4],
      symptoms: m[5], prodromal: m[6],
      weatherTags: [], sleepHours: null, diet24h: '',
      postSymptoms: '', postSymptomsDuration: null,
      medication: null,
      notes: m[7],
    });
  });

  const hp = [
    ['2024-01-16','',0,29,'',''],
    ['2024-02-14','',0,31,'',''],
    ['2024-03-16','',0,28,'',''],
    ['2024-04-13','',0,33,'',''],
    ['2024-05-16','',0,37,'',''],
    ['2024-06-22','',0,39,'',''],
    ['2024-07-31','',0,42,'',''],
    ['2024-09-11','',0,43,'',''],
    ['2024-10-24','',0,32,'',''],
    ['2024-11-25','',0,30,'',''],
    ['2024-12-25','',0,31,'',''],
    ['2025-01-25','',0,34,'',''],
    ['2025-02-28','',0,32,'',''],
    ['2025-04-01','',0,33,'',''],
    ['2025-05-04','',0,30,'',''],
    ['2025-06-03','2025-06-06',4,39,'2,3.5,0.5,0.5',''],
    ['2025-07-12','2025-07-16',5,39,'1,3.5,2,1,0.5',''],
    ['2025-08-20','2025-08-24',5,34,'2,1,1,0.5,0.5',''],
    ['2025-09-23','2025-09-29',7,34,'1,3,1.5,0.5,0.2,0.2,0.2',''],
    ['2025-10-27','',0,27,'1,3,3,0.5,0.5',''],
    ['2025-11-23','2025-11-27',5,36,'2,4,1,0.5,0.5',''],
    ['2025-12-29','',0,38,'1,3,0.5,0.5',''],
    ['2026-02-05','',0,35,'1,2',''],
    ['2026-03-12','2026-03-15',4,0,'1,1,1,1',''],
  ];
  hp.forEach((p, i) => {
    records.push({
      id: `hp${i}`, type: 'period',
      startDate: p[0], endDate: p[1],
      duration: p[2] || null, cycleLength: p[3] || null,
      padUsage: p[4], notes: p[5],
    });
  });

  saveData(records);
}

// ===== INIT =====
function showUserPicker() {
  const users = getAllUsers();
  const modal = document.getElementById('modal-user');
  const list = document.getElementById('user-list');
  let html = '';
  users.forEach(u => {
    html += `<button class="user-pick-btn" onclick="switchUser('${u.replace(/'/g, "\\'")}');closeModal('modal-user')">${u}</button>`;
  });
  list.innerHTML = html;
  openModal('modal-user');
}
function addNewUser() {
  const input = document.getElementById('new-user-input');
  const name = input.value.trim();
  if (!name) return;
  input.value = '';
  switchUser(name);
  closeModal('modal-user');
  showToast(`已切换到「${name}」`);
}
function init() {
  const urlUser = new URLSearchParams(window.location.search).get('user');
  if (urlUser) {
    currentUser = urlUser;
  } else {
    const users = getAllUsers();
    currentUser = users.length ? users[0] : 'default';
  }
  initUserKeys();
  registerUser(currentUser);
  // Migrate legacy data (no prefix) to the first user
  const legacyData = localStorage.getItem('migraine_tracker_data');
  if (legacyData && !localStorage.getItem(STORAGE_KEY) && STORAGE_KEY !== 'migraine_tracker_data') {
    localStorage.setItem(STORAGE_KEY, legacyData);
    const legacyCO = localStorage.getItem('migraine_tracker_custom_options');
    if (legacyCO) localStorage.setItem(CUSTOM_OPTIONS_KEY, legacyCO);
    const legacyRD = localStorage.getItem('migraine_tracker_removed_defaults');
    if (legacyRD) localStorage.setItem(REMOVED_DEFAULTS_KEY, legacyRD);
  }
  document.getElementById('current-user-name').textContent = currentUser;
  loadHistoricalData();
  migrateData();
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

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
        if (chip.dataset.value === 'yes') details.classList.remove('hidden');
        else details.classList.add('hidden');
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

  renderDashboard();
}

document.addEventListener('DOMContentLoaded', init);
