<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  normalizeForJson,
  parseCharacterCard,
  type CardParseResult,
  type PluginEntry
} from "./lib/card-parser";

const fileInput = ref<HTMLInputElement | null>(null);
const result = ref<CardParseResult | null>(null);
const errorMessage = ref("");
const query = ref("");
const isReading = ref(false);
const previewUrl = ref("");
const expandedGuid = ref<string | null>(null);

const visiblePlugins = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle || !result.value) return result.value?.plugins ?? [];
  return result.value.plugins.filter((plugin) => {
    return (
      plugin.guid.toLocaleLowerCase().includes(needle) ||
      plugin.dataKeys.some((key) => key.toLocaleLowerCase().includes(needle))
    );
  });
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function pluginJson(plugin: PluginEntry) {
  return JSON.stringify(normalizeForJson(plugin.rawData), null, 2);
}

function clearPreviewUrl() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
}

async function readFile(file: File) {
  isReading.value = true;
  errorMessage.value = "";
  result.value = null;
  query.value = "";
  expandedGuid.value = null;
  clearPreviewUrl();

  try {
    const parsed = await parseCharacterCard(file);
    result.value = parsed;
    previewUrl.value = URL.createObjectURL(parsed.previewBlob);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "The card could not be read.";
  } finally {
    isReading.value = false;
  }
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) void readFile(file);
  target.value = "";
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0];
  if (file) void readFile(file);
}

function exportJson() {
  if (!result.value) return;
  const exportValue = {
    fileName: result.value.fileName,
    productNumber: result.value.productNumber,
    marker: result.value.marker,
    cardVersion: result.value.cardVersion,
    characterName: result.value.characterName,
    blockNames: result.value.blockNames,
    plugins: result.value.plugins.map((plugin) => ({
      guid: plugin.guid,
      version: plugin.version,
      data: normalizeForJson(plugin.rawData)
    }))
  };
  const blob = new Blob([JSON.stringify(exportValue, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.value.fileName.replace(/\.png$/i, "")}-plugins.json`;
  link.click();
  URL.revokeObjectURL(url);
}

onBeforeUnmount(clearPreviewUrl);
</script>

<template>
  <main class="app-shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">KK Archive / Tools</p>
        <h1>Plugin Data Reader</h1>
      </div>
      <div class="lab-badge"><span></span> Browser-only processing</div>
    </header>

    <section class="intro-grid">
      <div class="intro-copy">
        <p class="section-number">01 / INPUT</p>
        <h2>Inspect the data hidden behind the image.</h2>
        <p>
          Select a Koikatu character card. Parsing happens entirely in this browser; the file is not uploaded.
        </p>
      </div>

      <button class="drop-zone" type="button" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop">
        <span class="drop-icon">PNG</span>
        <strong>{{ isReading ? "Reading card..." : "Choose or drop a character card" }}</strong>
        <small>PNG with embedded KKEx data</small>
      </button>
      <input ref="fileInput" class="visually-hidden" type="file" accept="image/png,.png" @change="onFileChange" />
    </section>

    <section v-if="errorMessage" class="error-panel" role="alert">
      <span>Read failed</span>
      <strong>{{ errorMessage }}</strong>
    </section>

    <template v-if="result">
      <section class="card-summary">
        <div class="card-preview-wrap">
          <img :src="previewUrl" :alt="result.characterName || result.fileName" class="card-preview" />
          <span>{{ formatBytes(result.fileSize) }}</span>
        </div>

        <div class="summary-copy">
          <p class="section-number">02 / CARD</p>
          <h2>{{ result.characterName || "Unnamed character" }}</h2>
          <p class="file-name">{{ result.fileName }}</p>
          <dl class="fact-grid">
            <div><dt>Marker</dt><dd>{{ result.marker }}</dd></div>
            <div><dt>Card version</dt><dd>{{ result.cardVersion }}</dd></div>
            <div><dt>Product</dt><dd>{{ result.productNumber }}</dd></div>
            <div><dt>Blocks</dt><dd>{{ result.blockNames.length }}</dd></div>
          </dl>
        </div>

        <div class="plugin-count">
          <strong>{{ result.plugins.length }}</strong>
          <span>plugin records</span>
        </div>
      </section>

      <section class="results-panel">
        <div class="results-heading">
          <div>
            <p class="section-number">03 / KKEX</p>
            <h2>Embedded plugin data</h2>
          </div>
          <button class="secondary-button" type="button" @click="exportJson">Export JSON</button>
        </div>

        <label class="search-field">
          <span>Filter GUID or data key</span>
          <input v-model="query" type="search" placeholder="e.g. materialeditor" />
        </label>

        <p class="result-count">Showing {{ visiblePlugins.length }} of {{ result.plugins.length }}</p>

        <div class="plugin-list">
          <article v-for="(plugin, index) in visiblePlugins" :key="plugin.guid" class="plugin-row">
            <button
              class="plugin-row-main"
              type="button"
              :aria-expanded="expandedGuid === plugin.guid"
              @click="expandedGuid = expandedGuid === plugin.guid ? null : plugin.guid"
            >
              <span class="row-index">{{ String(index + 1).padStart(2, "0") }}</span>
              <span class="plugin-identity">
                <strong>{{ plugin.guid }}</strong>
                <small>{{ plugin.dataKeys.length ? plugin.dataKeys.join(" / ") : "No named data keys" }}</small>
              </span>
              <span class="version-pill">v{{ plugin.version ?? "?" }}</span>
              <span class="expand-mark">{{ expandedGuid === plugin.guid ? "-" : "+" }}</span>
            </button>
            <pre v-if="expandedGuid === plugin.guid">{{ pluginJson(plugin) }}</pre>
          </article>
        </div>

        <p v-if="visiblePlugins.length === 0" class="empty-result">No plugin records match this filter.</p>
      </section>
    </template>

    <footer>
      <span>Vue 3 + TypeScript + MessagePack</span>
      <span>Files stay on this device</span>
    </footer>
  </main>
</template>
