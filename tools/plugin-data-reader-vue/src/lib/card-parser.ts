import { decode, type ExtData } from "@msgpack/msgpack";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const textDecoder = new TextDecoder("utf-8", { fatal: false });

type UnknownRecord = Record<string, unknown>;

export type PluginEntry = {
  guid: string;
  version: number | null;
  dataKeys: string[];
  rawData: unknown;
  resolvedData: unknown;
  embeddedImages: EmbeddedImage[];
};

export type EmbeddedImage = {
  path: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type CardParseResult = {
  fileName: string;
  fileSize: number;
  productNumber: number;
  marker: string;
  cardVersion: string;
  characterName: string | null;
  blockNames: string[];
  plugins: PluginEntry[];
  previewBlob: Blob;
};

class BinaryCursor {
  private readonly view: DataView;
  offset: number;

  constructor(private readonly bytes: Uint8Array, offset = 0) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = offset;
  }

  readUint8() {
    this.ensure(1);
    return this.view.getUint8(this.offset++);
  }

  readInt32LE() {
    this.ensure(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt64LE() {
    this.ensure(8);
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Card payload length is outside the supported range.");
    }
    return Number(value);
  }

  readBytes(length: number) {
    if (!Number.isInteger(length) || length < 0) {
      throw new Error("Card contains an invalid binary field length.");
    }
    this.ensure(length);
    const value = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readUtf8ByteLength() {
    return textDecoder.decode(this.readBytes(this.readUint8()));
  }

  private ensure(length: number) {
    if (this.offset + length > this.bytes.byteLength) {
      throw new Error("Card ended before all declared data could be read.");
    }
  }
}

function findPngEnd(bytes: Uint8Array) {
  if (PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error("This file is not a PNG character card.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset, false);
    const type = textDecoder.decode(bytes.subarray(offset + 4, offset + 8));
    const nextOffset = offset + 12 + length;
    if (nextOffset > bytes.byteLength) {
      throw new Error("PNG chunk data is incomplete.");
    }
    offset = nextOffset;
    if (type === "IEND") return offset;
  }

  throw new Error("PNG IEND chunk was not found.");
}

function toRecord(value: unknown): UnknownRecord | null {
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries(), ([key, item]) => [String(key), item]));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Uint8Array)) {
    return value as UnknownRecord;
  }
  return null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRecordValue(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function decodeMessagePack(bytes: Uint8Array, label: string) {
  try {
    return decode(bytes, { useBigInt64: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} MessagePack could not be decoded: ${message}`);
  }
}

function getBlockEntries(index: unknown) {
  const root = toRecord(index);
  const entries = root?.lstInfo;
  if (!Array.isArray(entries)) {
    throw new Error("Card block index does not contain lstInfo.");
  }

  return entries.map((entry, indexNumber) => {
    const record = toRecord(entry);
    const name = record?.name;
    const position = record ? asNumber(record.pos) : null;
    const size = record ? asNumber(record.size) : null;
    const version = record?.version;
    if (typeof name !== "string" || position === null || size === null) {
      throw new Error(`Card block index entry ${indexNumber + 1} is invalid.`);
    }
    return {
      name,
      position,
      size,
      version: typeof version === "string" ? version : String(version ?? "")
    };
  });
}

function parseCharacterName(value: unknown) {
  const record = toRecord(value);
  if (!record) return null;
  const fullName = getRecordValue(record, "fullname");
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  const lastName = getRecordValue(record, "lastname");
  const firstName = getRecordValue(record, "firstname");
  const combined = [lastName, firstName]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .map((part) => part.trim())
    .join(" ");
  return combined || null;
}

function parsePluginEntry(guid: string, value: unknown): PluginEntry {
  let version: number | null = null;
  let rawData: unknown = null;

  if (Array.isArray(value)) {
    version = asNumber(value[0]);
    rawData = value[1] ?? null;
  } else {
    const record = toRecord(value);
    if (record) {
      version = asNumber(getRecordValue(record, "version", "0"));
      rawData = getRecordValue(record, "data", "1") ?? null;
    }
  }

  const dataRecord = toRecord(rawData);
  const { resolvedData, embeddedImages } = resolvePluginData(rawData);
  return {
    guid,
    version,
    dataKeys: dataRecord ? Object.keys(dataRecord).sort((a, b) => a.localeCompare(b)) : [],
    rawData,
    resolvedData,
    embeddedImages
  };
}

function detectImageMimeType(bytes: Uint8Array) {
  if (
    bytes.byteLength >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  ) {
    return "image/png";
  }
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.byteLength >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }
  if (
    bytes.byteLength >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.byteLength >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return "image/tiff";
  }
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

function tryDecodeNestedMessagePack(bytes: Uint8Array) {
  if (bytes.byteLength === 0) return null;
  try {
    const decoded = decode(bytes, { useBigInt64: false });
    if (decoded instanceof Uint8Array && sameBytes(decoded, bytes)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Mirrors the Legacy reader's UnknownDataResolver: binary values are repeatedly
 * treated as MessagePack first, then retained as terminal byte arrays only when
 * they cannot be decoded any further.
 */
export function resolvePluginData(value: unknown) {
  const images: EmbeddedImage[] = [];
  const resolving = new WeakSet<object>();
  const maxDepth = 64;

  function resolve(item: unknown, path: string, depth: number): unknown {
    if (depth > maxDepth) return normalizeForJson(item);
    if (item instanceof Uint8Array) {
      const nested = tryDecodeNestedMessagePack(item);
      if (nested !== null) {
        return resolve(nested, `${path}::<msgpack>`, depth + 1);
      }
      const mimeType = detectImageMimeType(item);
      if (mimeType) images.push({ path, mimeType, bytes: item });
      return `byte[${item.byteLength}]`;
    }
    if (typeof item === "string") {
      return item.length > 500 ? `string[${item.length}] (Too big to display)` : item;
    }
    if (item === null || typeof item !== "object") return item;
    if (resolving.has(item)) return "[Circular]";
    resolving.add(item);

    let resolved: unknown;
    if (item instanceof Map) {
      resolved = Object.fromEntries(
        Array.from(item.entries(), ([key, child]) => [
          String(key),
          resolve(child, `${path}.${String(key)}`, depth + 1)
        ])
      );
    } else if (Array.isArray(item)) {
      resolved = item.map((child, index) => resolve(child, `${path}[${index}]`, depth + 1));
    } else {
      const ext = item as Partial<ExtData>;
      if (typeof ext.type === "number" && ext.data instanceof Uint8Array) {
        resolved = {
          extensionType: ext.type,
          data: resolve(ext.data, `${path}.data`, depth + 1)
        };
      } else {
        resolved = Object.fromEntries(
          Object.entries(item).map(([key, child]) => [key, resolve(child, `${path}.${key}`, depth + 1)])
        );
      }
    }
    resolving.delete(item);
    return resolved;
  }

  return {
    resolvedData: resolve(value, "$data", 0),
    embeddedImages: images
  };
}

function getPayloadBlock(payload: Uint8Array, entry: { name: string; position: number; size: number }) {
  const end = entry.position + entry.size;
  if (entry.position < 0 || entry.size < 0 || end > payload.byteLength) {
    throw new Error(`The ${entry.name} block points outside the card payload.`);
  }
  return payload.subarray(entry.position, end);
}

export function normalizeForJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) {
    const preview = Array.from(value.subarray(0, 24), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
    return { binaryLength: value.byteLength, hexPreview: preview };
  }
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries(), ([key, item]) => [String(key), normalizeForJson(item)]));
  }
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value !== null && typeof value === "object") {
    const ext = value as Partial<ExtData>;
    if (typeof ext.type === "number" && ext.data instanceof Uint8Array) {
      return { extensionType: ext.type, data: normalizeForJson(ext.data) };
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeForJson(item)]));
  }
  return value;
}

export async function parseCharacterCard(file: File): Promise<CardParseResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pngEnd = findPngEnd(bytes);
  if (pngEnd === bytes.byteLength) {
    throw new Error("This is a normal PNG without Koikatu character data.");
  }

  const cursor = new BinaryCursor(bytes, pngEnd);
  const productNumber = cursor.readInt32LE();
  const marker = cursor.readUtf8ByteLength();
  const cardVersion = cursor.readUtf8ByteLength();
  cursor.readBytes(cursor.readInt32LE());

  const indexBytes = cursor.readBytes(cursor.readInt32LE());
  const blockEntries = getBlockEntries(decodeMessagePack(indexBytes, "Block index"));
  const payload = cursor.readBytes(cursor.readInt64LE());

  const kkExEntry = blockEntries.find((entry) => entry.name === "KKEx");
  if (!kkExEntry) {
    throw new Error("This card has no KKEx plugin data block.");
  }

  const decodedPlugins = decodeMessagePack(getPayloadBlock(payload, kkExEntry), "KKEx");
  const pluginRecord = toRecord(decodedPlugins);
  if (!pluginRecord) {
    throw new Error("KKEx data is not a plugin dictionary.");
  }

  const parameterEntry = blockEntries.find((entry) => entry.name === "Parameter");
  const characterName = parameterEntry
    ? parseCharacterName(decodeMessagePack(getPayloadBlock(payload, parameterEntry), "Parameter"))
    : null;

  const plugins = Object.entries(pluginRecord)
    .map(([guid, value]) => parsePluginEntry(guid, value))
    .sort((left, right) => left.guid.localeCompare(right.guid));

  return {
    fileName: file.name,
    fileSize: file.size,
    productNumber,
    marker,
    cardVersion,
    characterName,
    blockNames: blockEntries.map((entry) => entry.name),
    plugins,
    previewBlob: new Blob([bytes.subarray(0, pngEnd)], { type: "image/png" })
  };
}
