'use strict';

// ===== Firebase Configuration =====
// 请将下面的空值替换为你的 Firebase 项目配置
// 获取方式: Firebase Console → 项目设置 → 你的应用 → Web 应用 → 配置
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSpxTWeGdVE7XXDrdlilc08CBWM9lzSek",
  authDomain: "careforhealth-795fd.firebaseapp.com",
  projectId: "careforhealth-795fd",
  storageBucket: "careforhealth-795fd.firebasestorage.app",
  messagingSenderId: "51645264327",
  appId: "1:51645264327:web:2c3009d99d855116a969e2"
};

let _fbAuth = null;
let _fbDb = null;
let _fbUser = null;
let _syncTimer = null;

function isFirebaseReady() {
  return !!FIREBASE_CONFIG.apiKey && typeof firebase !== 'undefined';
}

function initFirebase() {
  if (!isFirebaseReady()) return;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _fbAuth = firebase.auth();
    _fbDb = firebase.firestore();
    _fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});

    _fbAuth.onAuthStateChanged(user => {
      _fbUser = user;
      updateCloudUI();
      if (user) syncFromCloud();
    });
  } catch (e) {
    console.error('Firebase init failed:', e);
  }
}

// ===== Auth =====
async function cloudRegister(email, password) {
  return _fbAuth.createUserWithEmailAndPassword(email, password);
}
async function cloudLogin(email, password) {
  return _fbAuth.signInWithEmailAndPassword(email, password);
}
async function cloudLogout() {
  await _fbAuth.signOut();
  _fbUser = null;
  updateCloudUI();
  showToast('已退出登录');
}
async function cloudResetPassword(email) {
  await _fbAuth.sendPasswordResetEmail(email);
}

// ===== Sync =====
function triggerCloudSync() {
  if (!_fbUser) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => syncToCloud(), 2000);
}

async function syncToCloud() {
  if (!_fbUser || !_fbDb) return;
  try {
    updateSyncStatus('syncing');
    const records = getData();
    const customOptions = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}');
    const removedDefaults = JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '{}');

    await _fbDb.collection('users').doc(_fbUser.uid).set({
      records,
      customOptions,
      removedDefaults,
      lastSync: firebase.firestore.FieldValue.serverTimestamp(),
      email: _fbUser.email
    });
    updateSyncStatus('done');
  } catch (e) {
    console.error('Cloud sync failed:', e);
    updateSyncStatus('error');
  }
}

async function syncFromCloud() {
  if (!_fbUser || !_fbDb) return;
  try {
    updateSyncStatus('syncing');
    const doc = await _fbDb.collection('users').doc(_fbUser.uid).get();
    if (!doc.exists) {
      await syncToCloud();
      return;
    }
    const cloud = doc.data();
    let changed = false;

    // Merge records by ID (union)
    const local = getData();
    const localMap = new Map(local.map(r => [r.id, r]));
    (cloud.records || []).forEach(r => {
      if (r.id && !localMap.has(r.id)) {
        local.push(r);
        changed = true;
      }
    });
    if (changed) saveData(local, true);

    // Merge custom options
    if (cloud.customOptions && typeof cloud.customOptions === 'object') {
      const cur = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY) || '{}');
      for (const [g, items] of Object.entries(cloud.customOptions)) {
        if (!Array.isArray(items)) continue;
        if (!cur[g]) cur[g] = [];
        items.forEach(v => { if (!cur[g].includes(v)) cur[g].push(v); });
      }
      localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(cur));
    }

    // Merge removed defaults
    if (cloud.removedDefaults && typeof cloud.removedDefaults === 'object') {
      const cur = JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '{}');
      for (const [g, items] of Object.entries(cloud.removedDefaults)) {
        if (!Array.isArray(items)) continue;
        if (!cur[g]) cur[g] = [];
        items.forEach(v => { if (!cur[g].includes(v)) cur[g].push(v); });
      }
      localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(cur));
    }

    // Push merged data back to cloud
    await syncToCloud();

    if (changed) {
      showToast('已从云端同步数据');
      refreshCurrentView();
    }
    updateSyncStatus('done');
  } catch (e) {
    console.error('Cloud download failed:', e);
    updateSyncStatus('error');
  }
}

// ===== Cloud Auth UI =====
function showCloudAuth() {
  const modal = document.getElementById('modal-cloud-auth');
  document.getElementById('cloud-auth-error').textContent = '';
  document.getElementById('cloud-auth-email').value = '';
  document.getElementById('cloud-auth-password').value = '';
  setCloudAuthMode('login');
  openModal('modal-cloud-auth');
}

function setCloudAuthMode(mode) {
  document.getElementById('cloud-auth-title').textContent = mode === 'login' ? '登录' : '注册';
  document.getElementById('cloud-auth-submit').textContent = mode === 'login' ? '登录' : '注册';
  document.getElementById('cloud-auth-mode').dataset.mode = mode;
  document.getElementById('cloud-auth-switch').innerHTML = mode === 'login'
    ? '没有账号？<a href="#" onclick="setCloudAuthMode(\'register\');return false">去注册</a>'
    : '已有账号？<a href="#" onclick="setCloudAuthMode(\'login\');return false">去登录</a>';
  document.getElementById('cloud-auth-forgot').style.display = mode === 'login' ? '' : 'none';
  const confirmGroup = document.getElementById('cloud-auth-confirm-group');
  const pw2 = document.getElementById('cloud-auth-password2');
  if (mode === 'register') {
    confirmGroup.style.display = '';
    pw2.required = true;
  } else {
    confirmGroup.style.display = 'none';
    pw2.required = false;
    pw2.value = '';
  }
}

async function submitCloudAuth(e) {
  e.preventDefault();
  const email = document.getElementById('cloud-auth-email').value.trim();
  const password = document.getElementById('cloud-auth-password').value;
  const errEl = document.getElementById('cloud-auth-error');
  const submitBtn = document.getElementById('cloud-auth-submit');
  const mode = document.getElementById('cloud-auth-mode').dataset.mode;
  errEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '处理中...';

  if (mode === 'register') {
    const pw2 = document.getElementById('cloud-auth-password2').value;
    if (password !== pw2) { errEl.textContent = '两次输入的密码不一致'; submitBtn.disabled = false; submitBtn.textContent = '注册'; return; }
  }

  try {
    if (mode === 'register') {
      await cloudRegister(email, password);
      showToast('注册成功，数据将自动同步到云端');
    } else {
      await cloudLogin(email, password);
      showToast('登录成功');
    }
    closeModal('modal-cloud-auth');
  } catch (err) {
    const msgs = {
      'auth/email-already-in-use': '该邮箱已注册',
      'auth/invalid-email': '邮箱格式不正确',
      'auth/weak-password': '密码至少 6 位',
      'auth/user-not-found': '用户不存在',
      'auth/wrong-password': '密码错误',
      'auth/invalid-credential': '邮箱或密码错误',
      'auth/too-many-requests': '尝试次数过多，请稍后再试',
    };
    errEl.textContent = msgs[err.code] || err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'register' ? '注册' : '登录';
  }
}

async function doForgotPassword() {
  const email = document.getElementById('cloud-auth-email').value.trim();
  const errEl = document.getElementById('cloud-auth-error');
  if (!email) { errEl.textContent = '请先输入邮箱地址'; return; }
  try {
    await cloudResetPassword(email);
    errEl.style.color = 'var(--green)';
    errEl.textContent = '重置邮件已发送，请查收';
  } catch (err) {
    errEl.style.color = '';
    errEl.textContent = err.code === 'auth/user-not-found' ? '该邮箱未注册' : err.message;
  }
}

// ===== Cloud UI Updates =====
function updateCloudUI() {
  const authSection = document.getElementById('settings-cloud');
  if (!authSection) return;

  if (!isFirebaseReady()) {
    authSection.innerHTML = '<div class="settings-hint">云端同步未配置</div>';
    return;
  }

  if (_fbUser) {
    authSection.innerHTML = `
      <div class="cloud-user-info">
        <span class="cloud-user-email">☁️ ${esc(_fbUser.email)}</span>
        <span class="cloud-sync-badge" id="sync-badge">已连接</span>
      </div>
      <button class="settings-btn" onclick="syncFromCloud()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        立即同步
      </button>
      <button class="settings-btn danger-text" onclick="cloudLogout()">退出登录</button>
    `;
  } else {
    authSection.innerHTML = `
      <button class="settings-btn" onclick="showCloudAuth()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"/></svg>
        登录 / 注册（开启云端同步）
      </button>
      <div class="settings-hint">登录后数据自动同步到云端，跨设备访问、永不丢失</div>
    `;
  }
}

function updateSyncStatus(status) {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;
  if (status === 'syncing') {
    badge.textContent = '同步中…';
    badge.className = 'cloud-sync-badge syncing';
  } else if (status === 'done') {
    badge.textContent = '已同步';
    badge.className = 'cloud-sync-badge done';
  } else if (status === 'error') {
    badge.textContent = '同步失败';
    badge.className = 'cloud-sync-badge error';
  }
}
