# KK Archive

繁體中文 / English

---

## 專案簡介 | Project Overview

**KK Archive** 是一個用來整理、瀏覽與管理 KK / Koikatsu 相關檔案的網站。  
**KK Archive** is a website for organizing, browsing, and managing KK / Koikatsu-related files.

這個網站的核心目標是：  
The main goal of this project is to:

- 讓使用者可以快速找到想要的內容  
  Help users quickly find the content they need
- 讓管理者可以有效整理與審核資料  
  Help admins efficiently organize and review content
- 讓內容透過標籤分類，而不是混亂的全文搜尋  
  Keep content organized through structured tags instead of messy full-text search

---

## 這個網站在做什麼 | What This Website Does

網站主要提供以下功能：  
The website mainly provides the following functions:

- 瀏覽已發布的內容  
  Browse published content
- 依照標籤搜尋內容  
  Search content by tags
- 會員登入後查看限定內容  
  Let signed-in members view restricted content
- 管理者在後台建立、編輯、刪除內容  
  Let admins create, edit, and delete content in the admin panel
- 審核者協助整理未驗證內容  
  Let auditors help review and organize unverified content

---

## 主要使用者 | Main User Roles

### 一般訪客 | Visitors

- 不需要登入即可瀏覽公開內容  
  Can browse public content without signing in

### 會員 | Members

- 使用 Google 帳號登入  
  Sign in with Google
- 可查看會員限定內容  
  Can view member-only content

### 審核者 | Auditors

- 可整理尚未驗證的內容  
  Can review and organize unverified content
- 編輯後可將內容狀態從 `Unverified` 變成 `Edited`  
  Can move content from `Unverified` to `Edited`

### 管理者 | Admins

- 可管理所有內容與標籤  
  Can manage all content and tags
- 可完成最終審核  
  Can perform final approval
- 可管理帳號活動與風險狀態  
  Can monitor account activity and risk status

---

## 內容流程 | Content Workflow

每一篇內容都會經過簡單的狀態流程：  
Each content item goes through a simple review flow:

- `Unverified`  
  尚未整理完成  
  Not yet reviewed

- `Edited`  
  已由審核者或管理者整理  
  Reviewed and edited by auditor or admin

- `Passed`  
  已由管理者最終確認  
  Finally approved by admin

這樣做的目的是讓網站內容在公開前更一致、更乾淨。  
This helps keep content cleaner and more consistent before final approval.

---

## 搜尋方式 | Search Method

這個網站的搜尋不是靠自由輸入全文，而是靠結構化標籤。  
This website does not rely on free-text full search. It uses structured tags instead.

搜尋可依照以下條件進行：  
Users can search by:

- 作者 `Author`  
  Author
- 風格 `Style`  
  Style
- 用途 `Usage`  
  Usage
- 類型 `Type`  
  Type

這樣可以讓內容更容易管理，也能避免搜尋品質不穩定。  
This makes the archive easier to manage and keeps search results more consistent.

---

## 網站的技術基礎 | Technical Foundation

這個網站使用以下技術建立：  
This website is built with:

- `Next.js`
- `TypeScript`
- `Prisma`
- `Supabase Postgres`
- `Cloudflare R2`
- `Google OAuth`

簡單來說：  
In simple terms:

- 網站前台與後台由 `Next.js` 提供  
  The frontend and admin site run on Next.js
- 資料儲存在 `Supabase Postgres`  
  Data is stored in Supabase Postgres
- 圖片儲存在 `Cloudflare R2`  
  Images are stored in Cloudflare R2
- 登入使用 Google 帳號驗證  
  Sign-in uses Google authentication

---

## 為什麼這個專案有價值 | Why This Project Matters

這不是單純的圖片展示頁，而是一個有管理流程的內容平台。  
This is not just an image gallery. It is a content platform with management workflows.

它的價值在於：  
Its value comes from:

- 讓資料可被整理與長期維護  
  Making content maintainable over time
- 讓內容能被標準化分類  
  Standardizing how content is categorized
- 讓不同角色的人能分工合作  
  Supporting collaboration between different roles
- 提供公開瀏覽與內部審核兩種需求  
  Supporting both public browsing and internal review

---

## 目前已完成的功能 | Current Feature Status

目前已完成：  
Currently completed:

- 公開首頁  
  Public homepage
- 內容列表與分頁  
  Content listing with pagination
- 內容詳情頁  
  Content detail page
- 標籤搜尋  
  Tag-based search
- Google 登入  
  Google sign-in
- 後台內容管理  
  Admin content management
- 審核流程  
  Review workflow
- 使用者活動監控  
  User activity monitoring
- 圖片與來源連結管理  
  Image and original source link management

---

## 日常維護方式 | Daily Maintenance

網站日常維護大致分成兩部分：  
Daily maintenance is mainly split into two parts:

### 1. 內容維護 | Content Maintenance

- 匯入新的整理資料  
  Import newly prepared content
- 在後台修正標題、標籤、分類  
  Fix titles, tags, and categories in the admin panel
- 完成內容審核  
  Complete content review

### 2. 程式維護 | Product / Code Maintenance

- 在本地修改網站功能或畫面  
  Update features or design locally
- 將修改推到 GitHub  
  Push changes to GitHub
- 由 Vercel 自動重新部署  
  Let Vercel deploy automatically

---

## 誰適合閱讀這份專案說明 | Who This README Is For

這份 README 特別適合：  
This README is especially suitable for:

- 想快速理解專案目的的人  
  People who want to quickly understand the project
- 不一定是工程師的主管或人資  
  Managers or HR who may not be engineers
- 需要快速判斷專案成熟度的人  
  People who need to quickly evaluate project maturity

如果要看更詳細的站務或部署流程，請參考：  
For more detailed operations or deployment notes, see:

- [docs/site-operations-manual.txt](/c:/Users/mlcmlc/Desktop/KK%20Diction/docs/site-operations-manual.txt)
- [docs/deployment-stack.md](/c:/Users/mlcmlc/Desktop/KK%20Diction/docs/deployment-stack.md)

---

## 一句話總結 | One-Line Summary

**KK Archive 是一個以結構化標籤為核心、支援公開瀏覽與後台審核流程的 KK / Koikatsu 檔案整理平台。**  
**KK Archive is a structured-tag-based KK / Koikatsu archive platform with public browsing and internal review workflows.**
