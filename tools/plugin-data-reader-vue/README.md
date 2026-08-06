# Plugin Data Reader Vue Lab

This is the Vue 3 + TypeScript implementation of Plugin Data Reader.
The previous Blazor build remains available as a rollback route.

## Local routes

- Production Vue tool: `/tool-static/PluginDataReader`
- Vue verification alias: `/tool-static/PluginDataReaderVue`
- Legacy Blazor rollback: `/tool-static/PluginDataReaderLegacy`

## Commands

```powershell
npm run tool:vue:dev
npm run tool:vue:check
npm run tool:vue:build
```

The regular production build runs `tool:vue:build` first and writes the static
Vue application to `public/tool-static/PluginDataReaderVue`.

## Route replacement

The production route serves the generated Vue assets. The legacy route reads
the original Blazor assets without duplicating them.
