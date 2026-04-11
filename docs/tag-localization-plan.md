# Tag Localization Plan

## Goal

Let English, Simplified Chinese, and Japanese users search tags in their own language without changing the existing canonical tag system.

This must still obey current project rules:

- no public free-text content search
- search still selects existing tags only
- content/tag relationships stay on the canonical tag record

## Core idea

Do not split one tag into three tags.

Keep one canonical `Tag` record and add a localization layer for:

- display labels
- search aliases

Search UI uses the localized layer, but filtering still resolves back to the same `tag.id`.

## Recommended data model

### Keep existing table

- `Tag`

### Add localized label table

- `TagLocale`
  - `id`
  - `tagId`
  - `locale` (`en`, `zh-CN`, `ja`)
  - `label`
  - `createdAt`
  - `updatedAt`

Recommended uniqueness:

- unique `(tagId, locale)`

### Add alias table

- `TagLocaleAlias`
  - `id`
  - `tagLocaleId`
  - `alias`
  - `normalizedAlias`

Recommended uniqueness:

- unique `(tagLocaleId, normalizedAlias)`

Recommended indexes:

- index on `TagLocale.locale`
- index on `TagLocaleAlias.normalizedAlias`
- index on `(normalizedAlias, tagLocaleId)`

## Why this design

Benefits:

- no breakage to current content-tag relationships
- search still operates on real tags only
- one tag can have many language labels and many aliases
- UI can be localized without changing canonical tag names
- future languages stay easy to add

Avoid:

- translating the canonical tag itself
- creating separate tags per language
- fuzzy free-text guessing against content titles/descriptions

## Search behavior

### User-facing behavior

- English UI searches English localized labels/aliases
- Simplified Chinese UI searches Chinese localized labels/aliases
- Japanese UI searches Japanese localized labels/aliases

Example:

- canonical tag: `character card`
- English label: `Character Card`
- Chinese label: `角色卡`
- Japanese label: `キャラカード`

### Backend behavior

1. user types in current locale search box
2. autocomplete searches localized labels + aliases for that locale
3. user selects a result
4. UI stores canonical tag reference
5. filtering uses canonical `tag.id`

This keeps the project within the existing "tag-only search" rule.

## UI rules

### Search autocomplete

- show localized label for current locale
- optionally show canonical name as a smaller secondary line for admin/debug later, but not required now

### Selected filter chips

- display localized label for current locale

### Fallback behavior

If a locale entry is missing:

- fall back to canonical tag name

Recommended fallback order:

1. current locale label
2. English label if present
3. canonical tag name

## Admin workflow

Do not force full translation during initial tag creation.

### Phase 1

Keep current tag creation flow as-is.

### Phase 2

Add a tag localization editor for each tag:

- canonical tag name
- English label
- Simplified Chinese label
- Japanese label
- aliases per locale
- completion status

Recommended admin UX:

- existing tag admin stays focused on tag identity and type
- add a separate localization section or page
- untranslated locales are allowed

## Recommended implementation order

1. add schema for `TagLocale` and `TagLocaleAlias`
2. add read path with fallback logic
3. update search autocomplete to use localized labels/aliases
4. update selected filter chip rendering
5. add admin localization editor
6. backfill the highest-traffic tags first

## Key decisions already recommended

### Canonical tag language

Do not force-rewrite existing canonical tags.

Keep the current canonical tags as they are.

### Multiple aliases

Allow multiple aliases per locale.

Reason:

- users often search with synonyms
- Chinese may need several practical terms
- Japanese may have kana/kanji/English-mixed usage

### Chinese handling

Recommended:

- support Simplified Chinese labels in UI
- allow aliases to include common Traditional Chinese variants where useful

This avoids making users type only one exact written form.

### Missing translations

Do not block search or rendering because of missing translations.

Fallback to canonical/original label.

## Minimal future Prisma sketch

```prisma
model TagLocale {
  id        Int      @id @default(autoincrement())
  tagId      Int
  locale     String
  label      String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tag        Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  aliases    TagLocaleAlias[]

  @@unique([tagId, locale])
  @@index([locale])
}

model TagLocaleAlias {
  id              Int    @id @default(autoincrement())
  tagLocaleId     Int
  alias           String
  normalizedAlias String

  tagLocale TagLocale @relation(fields: [tagLocaleId], references: [id], onDelete: Cascade)

  @@unique([tagLocaleId, normalizedAlias])
  @@index([normalizedAlias])
}
```

## API/query direction

Search API should:

- receive current locale
- search `TagLocale.label` and `TagLocaleAlias.normalizedAlias`
- return canonical tag identity plus localized display label

Response shape should still include enough canonical info to keep existing filter logic stable.

## Open questions for later discussion

1. Should localized search match current locale only, or current locale plus English fallback?
2. Should Chinese search normalize simplified/traditional automatically?
3. Should aliases be exact-prefix only, or prefix + substring?
4. Do we want localized labels visible on public content detail chips immediately, or search UI first?
5. Which tag types should be translated first:
   - type
   - work
   - character
   - author
   - style
   - usage

## Recommended first practical milestone

Do this first:

- translate only search-facing labels for high-value tag types
- keep content detail page chips unchanged for now

Priority order:

1. type
2. work
3. character
4. style
5. usage
6. author

Reason:

- this gives the largest search UX gain fastest
- avoids a large full-site translation dependency

## Summary

Best approach:

- keep one canonical tag system
- add localized labels and aliases
- search by localized labels
- resolve to canonical `tag.id`
- allow missing translations with fallback
- build admin maintenance separately from current tag creation flow
