import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type TagReviewRecord = {
  work: string | null;
};

type WorkAliasEntry = {
  canonicalName: string;
  canonicalSlug: string;
  aliases: string[];
  sourceCount: number;
};

type WorkAliasFile = {
  version: number;
  generatedAt: string;
  tagType: "work";
  sourceDirectory: string;
  entryCount: number;
  entries: WorkAliasEntry[];
};

type PixivWorkReport = {
  matched?: Array<{
    work?: {
      canonicalName?: string;
      matchedAliases?: Array<{
        alias?: string;
      }>;
    };
  }>;
};

const TAG_REVIEW_DIR = path.resolve(process.cwd(), "db image", "tag");
const OUTPUT_PATH = path.resolve(process.cwd(), "db image", "tag.json");
const PIXIV_REPORT_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "reports",
  "pixiv-work-candidates.latest.json",
);

const manualAliases = new Map<string, string[]>([
  ["A Certain Magical Index", ["Toaru Majutsu no Index", "とある魔術の禁書目録", "魔法禁書目錄", "魔法禁书目录"]],
  ["A Certain Scientific Railgun", ["Toaru Kagaku no Railgun", "とある科学の超電磁砲", "超電磁砲", "超电磁炮"]],
  ["Aether Gazer", ["AG", "エーテルゲイザー", "深空之眼"]],
  ["Arknights", ["AK", "アークナイツ", "アクナイ", "明日方舟", "方舟"]],
  ["Arknights: Endfield", ["Endfield", "アークナイツ：エンドフィールド", "明日方舟：终末地", "明日方舟：終末地"]],
  ["Atelier Ryza", ["Ryza", "ライザのアトリエ", "萊莎的鍊金工房", "莱莎的炼金工房"]],
  ["Atelier Yumia", ["Yumia", "ユミアのアトリエ", "優米雅的鍊金工房", "优米雅的炼金工房"]],
  [
    "Atelier Yumia: The Alchemist of Memories & the Envisioned Land",
    [
      "Atelier Yumia",
      "Yumia",
      "ユミアのアトリエ",
      "優米雅的鍊金工房",
      "优米雅的炼金工房",
    ],
  ],
  ["Azur Lane", ["AL", "アズールレーン", "碧藍航線", "碧蓝航线", "艦B", "舰B"]],
  ["BanG Dream!", ["Bandori", "バンドリ", "邦邦"]],
  ["BanG Dream! Ave Mujica", ["Ave Mujica", "アベムジカ"]],
  ["BanG Dream! It's MyGO!!!!!", ["MyGO", "MyGO!!!!!", "バンドリ MyGO", "迷子團", "迷子团"]],
  ["Blue Archive", ["BA", "ブルーアーカイブ", "ブルアカ", "蔚藍檔案", "蔚蓝档案", "碧藍檔案", "碧蓝档案"]],
  ["Bocchi the Rock!", ["BTR", "ぼっち・ざ・ろっく！", "孤獨搖滾", "孤独摇滚"]],
  ["Chainsaw Man", ["チェンソーマン", "鏈鋸人", "电锯人"]],
  ["Creative Commons", ["CC"]],
  ["Dandadan", ["ダンダダン", "膽大黨", "胆大党"]],
  ["Date A Live", ["DAL", "デート・ア・ライブ", "約會大作戰", "约会大作战"]],
  ["Delicious in Dungeon", ["Dungeon Meshi", "ダンジョン飯", "迷宮飯", "迷宫饭"]],
  ["Fate/Grand Order", ["FGO", "フェイト/グランドオーダー", "命運冠位指定", "命运冠位指定"]],
  ["Frieren: Beyond Journey's End", ["Frieren", "葬送のフリーレン", "葬送的芙莉蓮", "葬送的芙莉莲"]],
  ["Gakuen Idolmaster", ["Gakumas", "学園アイドルマスター", "學園偶像大師", "学园偶像大师", "學偶", "学偶"]],
  ["Genshin Impact", ["GI", "Genshin", "原神"]],
  ["Girls' Frontline", ["GFL", "ドルフロ", "ドールズフロントライン", "少女前線", "少女前线", "少前"]],
  ["Girls' Frontline 2: Exilium", ["GFL2", "ドルフロ2", "少女前線2", "少女前线2", "少前2"]],
  ["Girls' Frontline: Neural Cloud", ["Neural Cloud", "少女前線：雲圖計劃", "少女前线：云图计划", "云图计划", "雲圖計劃"]],
  ["Goddess of Victory: NIKKE", ["NIKKE", "ニケ", "勝利の女神:NIKKE", "勝利女神：妮姬", "胜利女神：妮姬", "妮姬"]],
  ["Granblue Fantasy", ["GBF", "グラブル", "碧藍幻想", "碧蓝幻想"]],
  ["High School DxD", ["ハイスクールD×D", "惡魔高校D×D", "恶魔高校D×D"]],
  ["Hololive Production", ["Hololive", "Holo", "HoloPro", "ホロライブ", "ホロライブプロダクション", "齁", "木口"]],
  ["Honkai Impact 3rd", ["HI3", "Honkai 3rd", "崩壞3", "崩坏3", "崩3"]],
  ["Honkai: Star Rail", ["HSR", "Star Rail", "スターレイル", "崩鐵", "崩铁", "崩壞：星穹鐵道", "崩坏：星穹铁道"]],
  ["Kaguya-sama: Love Is War", ["かぐや様は告らせたい", "輝夜姬想讓人告白", "辉夜大小姐想让我告白"]],
  ["Kantai Collection", ["KanColle", "艦これ", "舰C"]],
  ["Mushoku Tensei: Jobless Reincarnation", ["無職轉生", "无职转生", "無職転生"]],
  ["My Dress-Up Darling", ["着せ恋", "更衣人偶墜入愛河", "更衣人偶坠入爱河"]],
  ["Needy Girl Overdose", ["NGO", "NEEDY GIRL OVERDOSE", "超てんちゃん", "病嬌天使", "病娇天使"]],
  ["Needy Streamer Overload", ["NSO", "NEEDY STREAMER OVERLOAD", "超てんちゃん", "主播女孩重度依賴", "主播女孩重度依赖"]],
  ["NieR Replicant", ["Nier Replicant", "ニーア レプリカント", "尼爾 人工生命", "尼尔 人工生命"]],
  ["NieR: Automata", ["Nier Automata", "NieR:Automata", "ニーア オートマタ", "尼爾：自動人形", "尼尔：机械纪元"]],
  ["NieR:Automata", ["Nier Automata", "NieR: Automata", "ニーア オートマタ", "尼爾：自動人形", "尼尔：机械纪元"]],
  ["Nijisanji", ["2434", "にじさんじ", "にじ", "彩虹社"]],
  ["One-Punch Man", ["OPM", "ワンパンマン", "一拳超人"]],
  ["Original", ["OC", "Original Character", "オリジナル", "原創", "原创"]],
  ["Oshi no Ko", ["【推しの子】", "推しの子", "我推的孩子"]],
  ["Pokémon", ["Pokemon", "ポケモン", "寶可夢", "宝可梦", "神奇寶貝", "口袋妖怪"]],
  ["Princess Connect! Re:Dive", ["Priconne", "プリコネ", "公主連結", "公主连结"]],
  ["Project Sekai: Colorful Stage!", ["Proseka", "プロセカ", "世界計畫", "世界计划"]],
  ["Punishing: Gray Raven", ["PGR", "パニグレ", "戰雙", "战双", "戦双帕弥什"]],
  ["Re:Zero", ["Re Zero", "リゼロ", "從零開始的異世界生活", "从零开始的异世界生活"]],
  ["Re:Zero - Starting Life in Another World", ["Re Zero", "リゼロ", "從零開始的異世界生活", "从零开始的异世界生活"]],
  ["Snowbreak: Containment Zone", ["Snowbreak", "塵白禁區", "尘白禁区"]],
  ["Solo Leveling", ["俺だけレベルアップな件", "我獨自升級", "我独自升级"]],
  ["Soul Land", ["斗羅大陸", "斗罗大陆"]],
  ["Spy x Family", ["SPY×FAMILY", "スパイファミリー", "間諜家家酒", "间谍过家家"]],
  ["Sword Art Online", ["SAO", "ソードアート・オンライン", "刀劍神域", "刀剑神域"]],
  ["Taimanin", ["対魔忍", "對魔忍", "对魔忍"]],
  ["Taimanin Yukikaze", ["対魔忍ユキカゼ", "對魔忍雪風", "对魔忍雪风"]],
  ["The Idolmaster", ["Idolmaster", "im@s", "アイドルマスター", "偶像大師", "偶像大师"]],
  ["The Idolmaster Cinderella Girls", ["Deresute", "デレマス", "アイドルマスター シンデレラガールズ", "偶像大師 灰姑娘女孩", "偶像大师 灰姑娘女孩"]],
  ["The Idolmaster Million Live!", ["Million Live", "ミリマス", "アイドルマスター ミリオンライブ！", "偶像大師 百萬人演唱會", "偶像大师 百万人演唱会"]],
  ["The Idolmaster Shiny Colors", ["Shiny Colors", "シャニマス", "アイドルマスター シャイニーカラーズ", "偶像大師 閃耀色彩", "偶像大师 闪耀色彩"]],
  ["To Love-Ru", ["To LOVEる", "出包王女"]],
  ["Tower of Fantasy", ["ToF", "幻塔"]],
  ["Uma Musume: Pretty Derby", ["Uma Musume", "ウマ娘", "賽馬娘", "赛马娘", "馬娘", "马娘"]],
  ["Vocaloid", ["ボカロ", "V家"]],
  ["Vtuber", ["VTuber", "VTubers", "VTubers", "V", "虛擬主播", "虚拟主播"]],
  ["VShojo", ["VShojo", "微笑小酒館"]],
  ["Alya Sometimes Hides Her Feelings in Russian", ["Alya", "Roshidere", "時々ボソッとロシア語でデレる隣のアーリャさん", "不時輕聲地以俄語遮羞的鄰座艾莉同學", "不时轻声地以俄语遮羞的邻座艾莉同学"]],
  ["Fate/stay night", ["FSN", "フェイト/ステイナイト", "命運停駐之夜", "命运停驻之夜", "命运之夜"]],
  ["Girls Band Cry", ["GBC", "ガールズバンドクライ", "少女樂團 吶喊吧", "少女乐团 呐喊吧"]],
  ["Horizon Walker", ["HW", "호라이즌 워커", "地平線行者", "地平线行者"]],
  ["Mobile Suit Gundam GQuuuuuuX", ["GQuuuuuuX", "ジークアクス", "機動戦士Gundam GQuuuuuuX", "機動戰士鋼彈 GQuuuuuuX", "机动战士高达 GQuuuuuuX"]],
  ["Nukitashi", ["ぬきたし", "抜きゲーみたいな島に住んでる貧乳はどうすりゃいいですか？", "拔作島", "拔作岛"]],
  ["Too Many Losing Heroines!", ["Makeine", "マケイン", "敗北女角太多了", "败北女角太多了", "敗犬女角太多了"]],
  ["Wuthering Waves", ["WuWa", "鳴潮", "鸣潮"]],
  ["Zenless Zone Zero", ["ZZZ", "ゼンレスゾーンゼロ", "絕區零", "绝区零"]],
]);

function normalizeValue(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

function slugifyTagName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "tag";
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) {
      continue;
    }

    const normalized = normalizeValue(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(value);
  }

  return output;
}

function appendManualAliases(canonicalName: string, aliases: string[]) {
  manualAliases.set(
    canonicalName,
    uniqueStrings([
      ...(manualAliases.get(canonicalName) ?? []),
      ...aliases,
    ]),
  );
}

appendManualAliases("The Idolmaster", [
  "The Idolmaster Cinderella Girls",
  "The Idolmaster Million Live!",
  "The Idolmaster Shiny Colors",
  "Cinderella Girls",
  "Million Live",
  "Shiny Colors",
  "Deresute",
]);

appendManualAliases("Love Live!", [
  "Love Live",
  "Love Live! Hasu no Sora Girls' High School Idol Club",
  "Love Live! Nijigasaki High School Idol Club",
  "Hasu no Sora",
  "Nijigasaki",
]);

appendManualAliases("Arknights", [
  "Arknights: Endfield",
  "Arknights Endfield",
  "Endfield",
]);

appendManualAliases("Fate/Grand Order", [
  "Fate/stay night",
  "Fate stay night",
  "FSN",
]);

appendManualAliases("Taimanin", [
  "Taimanin Yukikaze",
]);

appendManualAliases("Girls' Frontline", [
  "Girls' Frontline 2: Exilium",
  "Girls' Frontline: Neural Cloud",
  "Girls Frontline 2 Exilium",
  "Girls Frontline Neural Cloud",
  "GFL2",
  "Neural Cloud",
]);

appendManualAliases("BanG Dream!", [
  "BanG Dream! Ave Mujica",
  "BanG Dream! It's MyGO!!!!!",
  "BanG Dream Ave Mujica",
  "BanG Dream It's MyGO!!!!!",
  "Ave Mujica",
  "MyGO",
  "MyGO!!!!!",
]);

function buildAutoAliases(canonicalName: string) {
  const collapsed = canonicalName.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const withoutPunctuation = collapsed.replace(/[^0-9\p{L}]+/gu, " ").trim().replace(/\s+/gu, " ");
  const compact = collapsed.replace(/[^0-9\p{L}]+/gu, "");
  const withoutLeadingThe = /^the\s+/iu.test(collapsed) ? collapsed.replace(/^the\s+/iu, "").trim() : "";
  const withoutLeadingTheNoPunctuation = withoutLeadingThe
    ? withoutLeadingThe.replace(/[^0-9\p{L}]+/gu, " ").trim().replace(/\s+/gu, " ")
    : "";

  return uniqueStrings([
    collapsed,
    withoutPunctuation,
    compact,
    withoutLeadingThe,
    withoutLeadingTheNoPunctuation,
  ]);
}

async function loadWorkCounts() {
  const entries = await readdir(TAG_REVIEW_DIR, { withFileTypes: true });
  const workCounts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(TAG_REVIEW_DIR, entry.name);
    const payload = JSON.parse(await readFile(filePath, "utf8")) as TagReviewRecord;
    const work = payload.work?.trim();

    if (!work) {
      continue;
    }

    workCounts.set(work, (workCounts.get(work) ?? 0) + 1);
  }

  return workCounts;
}

async function loadObservedAliases() {
  const observedAliases = new Map<string, string[]>();

  if (!existsSync(PIXIV_REPORT_PATH)) {
    return observedAliases;
  }

  const report = JSON.parse(await readFile(PIXIV_REPORT_PATH, "utf8")) as PixivWorkReport;

  for (const item of report.matched ?? []) {
    const canonicalName = item.work?.canonicalName?.trim();
    if (!canonicalName) {
      continue;
    }

    const aliases = observedAliases.get(canonicalName) ?? [];
    for (const matched of item.work?.matchedAliases ?? []) {
      if (matched.alias?.trim()) {
        aliases.push(matched.alias.trim());
      }
    }
    observedAliases.set(canonicalName, aliases);
  }

  return observedAliases;
}

async function main() {
  const workCounts = await loadWorkCounts();
  const observedAliases = await loadObservedAliases();
  const canonicalNames = [...workCounts.keys()].sort((a, b) => a.localeCompare(b, "en"));

  const output: WorkAliasFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    tagType: "work",
    sourceDirectory: "db image/tag",
    entryCount: canonicalNames.length,
    entries: canonicalNames.map((canonicalName) => ({
      canonicalName,
      canonicalSlug: slugifyTagName(canonicalName),
      aliases: uniqueStrings([
        ...buildAutoAliases(canonicalName),
        ...(manualAliases.get(canonicalName) ?? []),
        ...(observedAliases.get(canonicalName) ?? []),
      ]),
      sourceCount: workCounts.get(canonicalName) ?? 0,
    })),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`[WORK TAG] Wrote ${output.entryCount} work alias entries to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("[WORK TAG] Failed to build work tag json.", error);
  process.exitCode = 1;
});
