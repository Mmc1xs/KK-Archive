import type { InstallGuideCopy, InstallGuideVersion } from "@/components/install-guide-page-view";
import type { UiLocale } from "@/lib/ui-locale";

export type InstallGuideVersionId = "kk" | "kks";

const KK_SOURCE_URL = process.env.NEXT_PUBLIC_KK_DOWNLOAD_URL?.trim() || "https://newapexcloud.com/s/hJH6xZ0w";
const KKS_SOURCE_URL = process.env.NEXT_PUBLIC_KKS_DOWNLOAD_URL?.trim() || undefined;
const KKS_ORIGINAL_SOURCE_URL = process.env.NEXT_PUBLIC_KKS_ORIGINAL_DOWNLOAD_URL?.trim() || KKS_SOURCE_URL;
const KKS_BR_SOURCE_URL = process.env.NEXT_PUBLIC_KKS_BR_DOWNLOAD_URL?.trim() || undefined;
const KKS_HF_PATCH_URL = "https://github.com/ManlyMarco/KKS-HF_Patch/releases";

const sharedIconUrls: Record<InstallGuideVersionId, string> = {
  kk: "https://cdn2.steamgriddb.com/grid/eacac8618eb5b3240debd191db819910.jpg",
  kks: "https://cdn2.steamgriddb.com/grid/fdbfb9f7a6e4aa57039a56775046451b.png"
};

const installGuideCopyByLocale = {
  "zh-CN": {
    eyebrow: "安装教学",
    title: "从干净来源到可用环境",
    description:
      "本体只是第一步。KK Party 建议先准备干净目录，再安装 KK 专用 HF Patch Full，确认 Studio 工作室可用后，再导入本站的角色卡、场景和 Mod。",
    backLabel: "返回首页",
    sourceTitle: "干净来源",
    setupTitle: "安装顺序",
    pluginTitle: "插件与资源",
    checkTitle: "完成检查",
    jumpLabel: "选择安装版本",
    unavailableNote: "这个版本的云端入口尚未接入，先按流程预留位置。",
    versions: [
      {
        id: "kk",
        code: "KK",
        name: "Koikatsu Party",
        tagline: "以干净 KK Party 本体为底，再用 KK-HF Patch Full 补齐插件、汉化、常用依赖与 Studio 工作室。",
        iconUrl: sharedIconUrls.kk,
        sourceHref: KK_SOURCE_URL,
        sourceLabel: "打开 KK 干净来源",
        pendingLabel: "待接入",
        steps: [
          "下载 KK 干净来源包，并确认压缩档完整。",
          "解压到短路径目录，例如 C:\\Games\\Koikatsu，不要放在系统保护目录，也不要直接覆盖旧的 Mod 环境。",
          "首次启动 KK Party 本体，确认游戏能正常进入，再关闭游戏。",
          "下载 KK 专用的 HF Patch Full 版；不要下载 GitHub 的 Source code 压缩包，也不要使用 KKS-HF Patch。",
          "执行 HF Patch 安装程式，目标目录选择刚刚解压的 KK Party 目录；一般使用者建议先沿用预设勾选。",
          "安装完成后再次启动游戏，并确认启动器或游戏目录中可以开启 Studio / CharaStudio 工作室。"
        ],
        pluginGroups: [
          {
            title: "HF Patch 会处理的内容",
            items: ["补入 KK Party 常缺的免费更新内容，其中包含 Studio 工作室入口。", "安装 BepInEx、KKAPI、常用插件、翻译与基础依赖。", "整理常见 Sideloader / zipmod 支援，让角色卡和场景更容易正常读取。"]
          },
          {
            title: "下载与版本判断",
            items: ["KK Party 使用 KK-HF Patch，不要与 KKS-HF Patch 混用。", "优先从 HF Patch 正式 Release、Patreon 说明页或其指向的镜像下载。", "如果 GitHub 页面同时出现 Source code，那不是给一般玩家安装的补丁包。"]
          },
          {
            title: "之后再放本站资源",
            items: ["角色卡：UserData\\chara\\female 或 UserData\\chara\\male", "场景卡：UserData\\studio\\scene，需要先确认 Studio 能开启。", "zipmod：mods 目录；缺服装、头发或配件时，优先补对应 zipmod。"]
          }
        ],
        checks: [
          "KK Party 可正常启动，没有卡在黑屏或加载界面。",
          "Studio / CharaStudio 可以从启动器或游戏目录独立开启。",
          "BepInEx 控制台或日志有正常载入记录。",
          "角色卡缩略图可显示，场景卡可以在 Studio 读取。",
          "如果之后使用 Steam 验证档案，可能需要重新执行一次 HF Patch。"
        ]
      },
      {
        id: "kks",
        code: "KKS",
        name: "Koikatsu Sunshine",
        tagline: "KKS 分为原版来源与 BR12 整合版：原版玩家建议安装 KKS HF Patch，BR12 玩家则直接使用整合环境。",
        iconUrl: sharedIconUrls.kks,
        sourceHref: KKS_ORIGINAL_SOURCE_URL,
        sourceLabel: "打开 KKS 干净来源",
        pendingLabel: "KKS 来源待接入",
        sourceOptions: [
          {
            label: "打开 KKS Original",
            href: KKS_ORIGINAL_SOURCE_URL,
            pendingLabel: "KKS Original 待接入",
            note: "干净本体来源；下载后建议接着安装 KKS HF Patch。"
          },
          {
            label: "打开 KKS BR12",
            href: KKS_BR_SOURCE_URL,
            pendingLabel: "KKS BR12 待接入",
            note: "BetterRepack 整合版，已经包含大量插件、Mod 与常用依赖。"
          }
        ],
        steps: [
          "先确认要走哪一条路线：KKS Original 是干净本体，KKS BR12 是 BetterRepack 整合版。",
          "如果下载 KKS Original，解压到独立目录，例如 C:\\Games\\KoikatsuSunshine，并确认它不是 KK 目录直接复制改名。",
          "首次启动 KKS Original 本体，确认 Sunshine 本体能正常进入。",
          [
            "下载并安装 KKS 专用的 ",
            { text: "KKS HF Patch", href: KKS_HF_PATCH_URL },
            "；不要安装 KK-HF Patch，也不要下载 GitHub 的 Source code 压缩包。"
          ],
          "如果下载 KKS BR12，解压后先直接启动测试，不要再把 KKS HF Patch 覆盖进 BR 整合目录。",
          "启动一次生成配置，再导入 Sunshine 卡片、场景与 zipmod。"
        ],
        pluginGroups: [
          {
            title: "KKS Original 建议",
            items: ["原版玩家建议安装 KKS HF Patch，用来补齐 BepInEx、KKSAPI、常用插件、翻译与基础依赖。", "HF Patch 目标目录必须选择 KKS Original 的游戏根目录。", "不要把 KK-HF Patch、KK 插件 DLL 或旧 KK 目录内容混进 KKS。"]
          },
          {
            title: "KKS BR12 整合版",
            items: ["BR12 已经是 BetterRepack 整合环境，通常不需要再安装 KKS HF Patch。", "更新插件时优先使用 KKManager 或 BR 提供的更新流程。", "如果想回到纯净版，应另开干净目录，不要在 BR 目录中混合拆装。"]
          },
          {
            title: "放置路径",
            items: ["角色卡：UserData\\chara\\female 或 UserData\\chara\\male", "场景卡：UserData\\studio\\scene", "zipmod：mods 目录"]
          }
        ],
        checks: [
          "能明确分辨当前目录是 KKS Original 还是 KKS BR12，不把两条路线混在同一个资料夹。",
          "KKS Original：游戏能先单独启动，之后才安装 KKS HF Patch，且目标目录选择 Sunshine 根目录。",
          "KKS BR12：解压后可直接启动，不额外覆盖安装 HF Patch，也不把 Original 的档案拷进去。",
          "启动游戏后 BepInEx 没有持续红字报错；如果有报错，先看是否混用了 KK 插件或旧 DLL。",
          "人物卡能在 Sunshine 的 Maker 读取，场景卡能在 Studio 读取。",
          "缺服装、头发、配件或场景物件时，优先补 KKS 对应 zipmod，不用 KK 旧版资源硬凑。"
        ]
      }
    ]
  },
  en: {
    eyebrow: "Install Guide",
    title: "From clean source to usable setup",
    description:
      "The base package is only the first step. Prepare a clean folder, install the matching framework and plugins, then add cards, scenes, and mods from the archive.",
    backLabel: "Back to Home",
    sourceTitle: "Clean Source",
    setupTitle: "Setup Order",
    pluginTitle: "Plugins and Resources",
    checkTitle: "Final Checks",
    jumpLabel: "Choose setup version",
    unavailableNote: "This cloud source is not connected yet, so the slot is reserved for later.",
    versions: [
      {
        id: "kk",
        code: "KK",
        name: "Koikatsu Party",
        tagline: "The baseline environment for most legacy KK cards, scenes, and zipmod resources.",
        iconUrl: sharedIconUrls.kk,
        sourceHref: KK_SOURCE_URL,
        sourceLabel: "Open KK clean source",
        pendingLabel: "Pending",
        steps: [
          "Download the KK clean source package and confirm the archive is complete.",
          "Extract it to a short path such as C:\\Games\\Koikatsu, outside protected system folders.",
          "Launch the base game once, confirm it opens, then close it.",
          "Install the KK framework and plugin pack. Do not mix KKS-only plugins into this folder.",
          "Launch again so plugins generate config folders, then add cards, scenes, and mods."
        ],
        pluginGroups: [
          {
            title: "Core framework",
            items: ["BepInEx 5 series", "KKAPI", "BepisPlugins / ExtensibleSaveFormat", "XUnity Auto Translator"]
          },
          {
            title: "Common resources",
            items: ["Sideloader Modpack or zipmod resources", "MaterialEditor / MoreAccessories dependencies", "Creator-specific plugin requirements"]
          },
          {
            title: "Resource folders",
            items: ["Character cards: UserData\\chara\\female or UserData\\chara\\male", "Scenes: UserData\\studio\\scene", "zipmod files: mods"]
          }
        ],
        checks: [
          "The game opens normally without hanging on a black screen.",
          "BepInEx logs show normal plugin loading.",
          "Character thumbnails appear; missing parts usually mean missing zipmods or dependencies.",
          "Test with a small batch of resources before importing everything."
        ]
      },
      {
        id: "kks",
        code: "KKS",
        name: "Koikatsu Sunshine",
        tagline: "KKS has two routes: Original players should install KKS HF Patch, while BR12 players should use the integrated BetterRepack setup as-is.",
        iconUrl: sharedIconUrls.kks,
        sourceHref: KKS_ORIGINAL_SOURCE_URL,
        sourceLabel: "Open KKS clean source",
        pendingLabel: "KKS source pending",
        sourceOptions: [
          {
            label: "Open KKS Original",
            href: KKS_ORIGINAL_SOURCE_URL,
            pendingLabel: "KKS Original pending",
            note: "Clean base game source; install KKS HF Patch after downloading."
          },
          {
            label: "Open KKS BR12",
            href: KKS_BR_SOURCE_URL,
            pendingLabel: "KKS BR12 pending",
            note: "BetterRepack integrated setup with many plugins, mods, and common dependencies already included."
          }
        ],
        steps: [
          "Choose the correct route first: KKS Original is the clean base game, and KKS BR12 is the BetterRepack integrated setup.",
          "For KKS Original, extract it to a separate folder such as C:\\Games\\KoikatsuSunshine; do not rename a KK folder and treat it as KKS.",
          "Launch KKS Original once and confirm Sunshine opens correctly.",
          "Download and install KKS HF Patch. Do not use KK-HF Patch or a GitHub Source code archive.",
          "For KKS BR12, launch the extracted pack first and do not overwrite the BR folder with KKS HF Patch.",
          "Launch once to generate configs, then add Sunshine cards, scenes, and zipmods."
        ],
        pluginGroups: [
          {
            title: "KKS Original",
            items: ["Install KKS HF Patch to add BepInEx, KKSAPI, common plugins, translations, and baseline dependencies.", "Point the HF Patch installer at the KKS Original game root.", "Do not mix KK-HF Patch, KK plugin DLLs, or old KK folder contents into KKS."]
          },
          {
            title: "KKS BR12",
            items: ["BR12 is already a BetterRepack environment, so it usually should not receive a separate KKS HF Patch install.", "Use KKManager or BetterRepack's own update flow for plugin updates.", "For a clean setup, start from KKS Original in a separate folder instead of stripping and mixing the BR folder."]
          },
          {
            title: "Resource folders",
            items: ["Character cards: UserData\\chara\\female or UserData\\chara\\male", "Scenes: UserData\\studio\\scene", "zipmod files: mods"]
          }
        ],
        checks: [
          "KK and KKS stay in separate folders.",
          "The Original route uses KKS HF Patch, not KK-HF Patch.",
          "The BR12 route has not been overwritten with HF Patch.",
          "BepInEx logs do not show repeated red errors.",
          "Sunshine cards load in the maker.",
          "For missing outfits, hair, or accessories, check KKS zipmods first."
        ]
      }
    ]
  },
  ja: {
    eyebrow: "導入ガイド",
    title: "クリーンソースから使える環境へ",
    description:
      "本体だけでは十分ではありません。クリーンなフォルダを用意し、対応するフレームワークとプラグインを入れてから、カード、シーン、Mod を追加します。",
    backLabel: "ホームへ戻る",
    sourceTitle: "クリーンソース",
    setupTitle: "導入順",
    pluginTitle: "プラグインとリソース",
    checkTitle: "完了チェック",
    jumpLabel: "導入バージョンを選択",
    unavailableNote: "このクラウドソースはまだ接続されていないため、枠だけを予約しています。",
    versions: [
      {
        id: "kk",
        code: "KK",
        name: "Koikatsu Party",
        tagline: "多くの旧来 KK カード、シーン、zipmod リソース向けの基本環境です。",
        iconUrl: sharedIconUrls.kk,
        sourceHref: KK_SOURCE_URL,
        sourceLabel: "KK クリーンソースを開く",
        pendingLabel: "接続待ち",
        steps: [
          "KK クリーンソースをダウンロードし、圧縮ファイルが完全か確認します。",
          "C:\\Games\\Koikatsu など短いパスへ解凍し、保護されたシステムフォルダは避けます。",
          "本体を一度起動し、正常に開くことを確認してから閉じます。",
          "KK 用のフレームワークとプラグインパックを入れます。KKS 専用プラグインは混ぜないでください。",
          "もう一度起動して設定フォルダを生成し、その後カード、シーン、Mod を追加します。"
        ],
        pluginGroups: [
          {
            title: "コア環境",
            items: ["BepInEx 5 系列", "KKAPI", "BepisPlugins / ExtensibleSaveFormat", "XUnity Auto Translator"]
          },
          {
            title: "よく使うリソース",
            items: ["Sideloader Modpack または zipmod", "MaterialEditor / MoreAccessories 系の依存", "作者が指定した追加プラグイン"]
          },
          {
            title: "配置フォルダ",
            items: ["キャラカード：UserData\\chara\\female または UserData\\chara\\male", "シーン：UserData\\studio\\scene", "zipmod：mods"]
          }
        ],
        checks: [
          "黒画面や読み込み停止なしで起動できます。",
          "BepInEx ログに正常な読み込み記録があります。",
          "カードのサムネイルが表示されます。欠品は zipmod や依存不足を先に確認します。",
          "大量投入の前に、少量のリソースでテストします。"
        ]
      },
      {
        id: "kks",
        code: "KKS",
        name: "Koikatsu Sunshine",
        tagline: "KKS には Original と BR12 の 2 ルートがあります。Original は KKS HF Patch 推奨、BR12 は統合済み環境として扱います。",
        iconUrl: sharedIconUrls.kks,
        sourceHref: KKS_ORIGINAL_SOURCE_URL,
        sourceLabel: "KKS クリーンソースを開く",
        pendingLabel: "KKS ソース接続待ち",
        sourceOptions: [
          {
            label: "KKS Original を開く",
            href: KKS_ORIGINAL_SOURCE_URL,
            pendingLabel: "KKS Original 接続待ち",
            note: "クリーンな本体ソースです。ダウンロード後は KKS HF Patch の導入を推奨します。"
          },
          {
            label: "KKS BR12 を開く",
            href: KKS_BR_SOURCE_URL,
            pendingLabel: "KKS BR12 接続待ち",
            note: "BetterRepack 統合版で、多くのプラグイン、Mod、基本依存が含まれています。"
          }
        ],
        steps: [
          "最初にルートを選びます。KKS Original はクリーン本体、KKS BR12 は BetterRepack 統合版です。",
          "KKS Original は C:\\Games\\KoikatsuSunshine など、KK とは別のフォルダへ解凍します。KK フォルダを名前変更しただけのものは使いません。",
          "KKS Original 本体を一度起動し、Sunshine が正常に開くことを確認します。",
          "KKS 用の HF Patch をダウンロードして導入します。KK-HF Patch や GitHub の Source code 圧縮ファイルは使いません。",
          "KKS BR12 は解凍後にそのまま起動確認し、BR フォルダへ KKS HF Patch を上書き導入しないでください。",
          "一度起動して設定を生成してから、Sunshine 用カード、シーン、zipmod を追加します。"
        ],
        pluginGroups: [
          {
            title: "KKS Original",
            items: ["KKS HF Patch で BepInEx、KKSAPI、一般的なプラグイン、翻訳、基本依存を補います。", "HF Patch の導入先は KKS Original のゲームルートにします。", "KK-HF Patch、KK 用 DLL、古い KK フォルダ内容を KKS に混ぜないでください。"]
          },
          {
            title: "KKS BR12",
            items: ["BR12 は BetterRepack 環境のため、通常は別途 KKS HF Patch を導入しません。", "プラグイン更新は KKManager または BetterRepack 側の更新手順を優先します。", "クリーン環境にしたい場合は、BR フォルダを削りながら使うより別フォルダの KKS Original から始めます。"]
          },
          {
            title: "配置フォルダ",
            items: ["キャラカード：UserData\\chara\\female または UserData\\chara\\male", "シーン：UserData\\studio\\scene", "zipmod：mods"]
          }
        ],
        checks: [
          "KK と KKS は別フォルダで管理します。",
          "Original ルートでは KK-HF Patch ではなく KKS HF Patch を使います。",
          "BR12 ルートでは HF Patch を上書き導入していません。",
          "BepInEx ログに赤字エラーが連続していません。",
          "Sunshine 用カードがメーカーで読み込めます。",
          "衣装、髪、アクセサリ不足は KKS 用 zipmod を先に確認します。"
        ]
      }
    ]
  }
} satisfies Record<UiLocale, InstallGuideCopy>;

const singleVersionTitles = {
  "zh-CN": {
    kk: "KK 安装教学",
    kks: "KKS 安装教学"
  },
  en: {
    kk: "KK Install Guide",
    kks: "KKS Install Guide"
  },
  ja: {
    kk: "KK 導入ガイド",
    kks: "KKS 導入ガイド"
  }
} satisfies Record<UiLocale, Record<InstallGuideVersionId, string>>;

function findVersion(locale: UiLocale, versionId: InstallGuideVersionId): InstallGuideVersion {
  return installGuideCopyByLocale[locale].versions.find((version) => version.id === versionId)!;
}

export function getInstallGuideCopy(locale: UiLocale, versionId?: InstallGuideVersionId): InstallGuideCopy {
  const copy = installGuideCopyByLocale[locale];

  if (!versionId) {
    return copy;
  }

  const version = findVersion(locale, versionId);
  const singleVersionOverrides =
    locale === "zh-CN" && versionId === "kk"
      ? {
          pluginTitle: "HF Patch 重点",
          setupTitle: "建议流程",
          checkTitle: "安装后检查"
        }
      : {};

  return {
    ...copy,
    ...singleVersionOverrides,
    title: singleVersionTitles[locale][versionId],
    description: version.tagline,
    versions: [version]
  };
}
