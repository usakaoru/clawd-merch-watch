# clawd-merch-watch

每 5 分鐘檢查 [claude.dev/terminal](https://claude.dev/terminal/) 的 `/plushies`（Clawd 玩偶）與 `/stickers`（貼紙）領取活動是否重新開放，重開時推 Telegram。

- 檢查邏輯：`check.mjs`
- 排程：`.github/workflows/watch.yml`
- 需要的 Secrets：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`
- 手動測試：Actions → Clawd 周邊重開監看 → Run workflow → 勾選「測試模式」
