// Clawd 周邊（玩偶/貼紙）重開監看 — GitHub Actions 雲端版
// 本機版在 D:\Claude生成工具庫\Clawd周邊重開監看\檢查是否重開.ps1，判斷邏輯相同。
//
// 1. 抓 claude.dev/terminal 頁面裡的 brilliantmade.com/r/<slug> 連結（官方換網址也抓得到），抓不到退回已知 slug。
// 2. 逐一開連結：最後網址含 /sorry 或內容有 "has expired" → 關閉；其他 200 → 開放。
// 3. 狀態存 state.json（由 workflow 提交回 repo），只有「關閉→開放」才推 Telegram。
// 4. 連續 6 次（約 30 分鐘）全部連不上才推一則警告，避免雲端壞掉都不知道。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TERM_URL = 'https://claude.dev/terminal/';
const KNOWN = ['claude-code-plushies', 'claude-code-stickers'];
const LABELS = {
  'claude-code-plushies': 'Clawd 玩偶 (/plushies)',
  'claude-code-stickers': 'Claude Code 貼紙 (/stickers)',
};
const STATE = 'state.json';
const ERROR_ALERT_AT = 6;
const TEST = process.env.TEST_MODE === 'true';
const HEADERS = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' };

async function notify(text) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = process.env;
  if (!token || !chatId) { console.log('[Telegram] 缺 secrets，跳過推播'); return; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    console.log(`[Telegram] ${r.ok ? '已送出' : `失敗 HTTP ${r.status}`}`);
  } catch (e) {
    console.log(`[Telegram] 失敗：${e.message}`);
  }
}

let slugs = [];
try {
  const html = await (await fetch(TERM_URL, { headers: HEADERS })).text();
  slugs = [...new Set([...html.matchAll(/brilliantmade\.com\/r\/([A-Za-z0-9_-]+)/g)].map(m => m[1]))];
} catch (e) {
  console.log(`抓 claude.dev/terminal 失敗，改用已知連結：${e.message}`);
}
if (!slugs.length) slugs = KNOWN;

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
state.slugs ??= {};
let okCount = 0;

for (const slug of slugs) {
  const url = `https://app.brilliantmade.com/r/${slug}`;
  const label = LABELS[slug] ?? `新活動 ${slug}`;
  let status;
  try {
    const r = await fetch(url, { headers: HEADERS });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    status = /\/sorry/.test(r.url) || /has expired/i.test(body) ? 'closed' : 'open';
    console.log(`[${slug}] ${status}  ${r.url}`);
    okCount++;
  } catch (e) {
    console.log(`[${slug}] 檢查失敗：${e.message}`);
    continue;
  }

  const prev = state.slugs[slug];
  if (TEST) {
    await notify(`🧪 [雲端監看] 測試：${label} 目前${status === 'open' ? '開放中' : '已關閉'}\n${url}`);
  } else if (status === 'open' && prev !== 'open') {
    await notify(`🧸 ${label} 重新開放登記了！名額搶很快，快去填：\n${url}\n（GitHub 雲端監看）`);
  }
  state.slugs[slug] = status;
}

if (okCount === 0) {
  state.errors = (state.errors ?? 0) + 1;
  if (state.errors === ERROR_ALERT_AT) {
    await notify(`⚠️ [雲端監看] 已連續 ${ERROR_ALERT_AT} 次連不上 claude.dev / Brilliant，雲端監看可能失效，請看 GitHub Actions 紀錄。`);
  }
} else {
  state.errors = 0;
}

writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
