// 行为埋点 —— 产品核心卖点的地基
// 每条事件: { event, ts, level, attempt, timeSinceLast, ...payload }
// 存 LocalStorage 'el_track'，最终被行为画像读取

const KEY = 'el_track';
let lastTs = 0;
let attempt = {}; // 每关第几次尝试

export function track(event, level = null, payload = {}) {
  const now = Date.now();
  if (level) attempt[level] = (attempt[level] || 0) + 1;
  const record = {
    event,
    ts: now,
    level,
    attempt: level ? attempt[level] : null,
    timeSinceLast: lastTs ? now - lastTs : 0,
    ...payload,
  };
  lastTs = now;
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    arr.push(record);
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch (e) {
    // 存储满/隐私模式：埋点静默失败，不影响游戏
  }
  if (import.meta.env.DEV) console.log('[track]', event, level, payload);
}

export function getTracks() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearTracks() {
  localStorage.removeItem(KEY);
  attempt = {};
  lastTs = 0;
}
