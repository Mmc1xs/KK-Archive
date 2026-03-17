# 部署架構

這個專案目前建議的正式環境拆分如下：

- Vercel：部署 Next.js 網站
- Hosted Postgres：Supabase / Neon / 其他託管 Postgres
- Cloudflare R2：存放圖片
- Cloudflare DNS / SSL：網域、HTTPS、快取

## 為什麼這樣拆

- 網站目前本來就是用圖片 URL 顯示內容，R2 很適合接進現有結構。
- `db image/clean` 的圖片量已經超過 Supabase Free Storage 適合承受的範圍。
- 把圖片流量從網站主機拆出去，之後比較不容易被頻寬拖慢。

## 第一階段

- 先讓本地專案維持可運作。
- 補齊 R2 環境變數。
- 提供 `db image/clean` 的上傳腳本。
- 產生上傳 manifest 與公開圖片 URL。
- 根據 `db image/clean/*/_meta.json` 產生 clean import manifest。

## 第二階段

- 把 Prisma 從 SQLite 遷到 Hosted Postgres。
- 保留目前的 Google OAuth + cookie session。
- 在正式部署前，做一次 SQLite -> Postgres 的資料搬遷。

## Postgres 遷移流程

1. 本地開發若仍使用 SQLite：

```bash
DATABASE_URL="file:./prisma/dev.db"
```

2. 填入正式的 Postgres 連線：

```bash
POSTGRES_POOLED_URL="postgresql://...pooler...:6543/postgres?pgbouncer=true&connection_limit=1"
POSTGRES_SESSION_URL="postgresql://...pooler...:5432/postgres"
POSTGRES_DIRECT_URL="postgresql://...db...:5432/postgres" # 選填，通常是 IPv6 / IPv4 add-on 才需要
```

3. 產生 Postgres Prisma Client：

```bash
npm run db:generate:postgres
```

4. 將 schema 推到 Postgres：

```bash
npm run db:push:postgres
```

5. 把本地資料搬到 Postgres：

```bash
npm run db:migrate:sqlite-to-postgres
```

6. 切換 app runtime 使用 Postgres：

```bash
npm run db:use:postgres
```

7. 建置正式版：

```bash
npm run build:postgres
```

如果之後要切回本地 SQLite 開發：

```bash
npm run db:use:sqlite
npm run db:generate
```

這個遷移流程會搬過去的資料有：

- users
- user login events
- contents
- content images
- content download links
- tags
- content-tag relations

而且腳本也會重設 Postgres sequence，避免之後新增資料時 ID 接不起來。

## R2 上傳腳本

指令：

```bash
npm run r2:upload-clean
```

需要的環境變數：

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `CLEAN_IMAGE_ROOT`

腳本會產出：

```text
scripts/r2-upload-manifest.json
```

## Clean Import Manifest

指令：

```bash
npm run clean:manifest
```

腳本會讀取每個 `db image/clean/<folder>/_meta.json`，整理出：

- folder id
- anchor message id
- Pixiv artwork URL
- Pixiv artwork ID
- 本地圖片路徑
- 第一張圖作為 cover 候選
- 原始來源文字

## post.json 產生與匯入

### 全量重跑整個 clean 資料庫

如果你是要把整批 `db image/clean` 全部重新整理並匯入，請依照這個順序：

```bash
npm run clean:manifest
npm run clean:pixiv
npm run r2:upload-clean
npm run clean:post-json
npm run clean:import-all
```

### 只處理新加入的 clean 資料

平常日常更新，最推薦直接跑：

```bash
npm run sync:new
```

這個指令現在只會處理「尚未匯入網站的新資料」，會自動依序執行：

```bash
npm run clean:pixiv:new
npm run r2:upload-clean:new
npm run clean:post-json:new
npm run clean:import-new
```

### 一鍵全量重建

如果你要整批 clean 資料全部重新整理並重新匯入，可以直接跑：

```bash
npm run sync:all
```

### 說明

- `clean:manifest` 不需要重複跑兩次。
- `clean:post-json` 只會產生每個資料夾的 `post.json`，**不會自動寫進資料庫**。
- `clean:post-json:new` 只會重寫尚未匯入的新資料夾。
- `sync:new` = `clean:sync-new`
- `sync:all` = `clean:sync-all`
- 真正把內容寫進網站資料庫的是：
  - `npm run clean:import-new`
  - 或 `npm run clean:import-all`

`clean:post-json` 會使用 `scripts/r2-upload-manifest.json` 中的 R2 公開網址，把以下欄位寫進每個 `db image/clean/<folder>/post.json`：

- `coverImageUrl`
- `imageUrls`
- `sourceLink`
