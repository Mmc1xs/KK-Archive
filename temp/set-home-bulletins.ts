import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Locale = "zh-CN" | "en" | "ja";

type BulletinSeed = {
  date: string;
  zh: { title: string; summary: string };
  en: { title: string; summary: string };
  ja: { title: string; summary: string };
};

const seeds: BulletinSeed[] = [
  {
    date: "2026-05-03T12:00:00+08:00",
    zh: {
      title: "[站务] 公告栏后台上线（Admin）",
      summary: "首页公告可由后台直接新增、编辑、删除，支持中/英/日三语内容管理。"
    },
    en: {
      title: "[Ops] Admin Bulletin Manager Is Live",
      summary: "Homepage bulletins can now be created, edited, and deleted in admin with EN/ZH/JA support."
    },
    ja: {
      title: "[運営] 管理画面の掲示板管理を公開",
      summary: "ホームのお知らせは管理画面から追加・編集・削除でき、日/英/中に対応しました。"
    }
  },
  {
    date: "2026-05-02T12:00:00+08:00",
    zh: {
      title: "[性能] 首页入口导向逻辑优化",
      summary: "首页入口改为更缓存友好的导向方式，减少不必要的服务器运算负担。"
    },
    en: {
      title: "[Performance] Homepage Entry Redirect Optimized",
      summary: "The homepage entry now uses a cache-friendly redirect flow to reduce unnecessary server compute."
    },
    ja: {
      title: "[性能] ホーム入口のリダイレクトを最適化",
      summary: "キャッシュに優しい導線へ変更し、不要なサーバー計算コストを削減しました。"
    }
  },
  {
    date: "2026-05-01T12:00:00+08:00",
    zh: {
      title: "[合规] 法规页面与申诉流程补齐",
      summary: "已完成 18 USC 2257 声明与 DMCA 政策页面，并补齐站内合规说明入口。"
    },
    en: {
      title: "[Compliance] Legal & Takedown Pages Completed",
      summary: "18 USC 2257 and DMCA policy pages are now in place, with clear compliance entry points on-site."
    },
    ja: {
      title: "[コンプライアンス] 法務ページと申立導線を整備",
      summary: "18 USC 2257 と DMCA ポリシーを整備し、サイト内の案内導線を追加しました。"
    }
  },
  {
    date: "2026-04-26T12:00:00+08:00",
    zh: {
      title: "[内容维护] cut queue 导入流程标准化",
      summary: "新增 queue 规范与导入流程，降低返工并提升批量建帖一致性。"
    },
    en: {
      title: "[Content Ops] Cut Queue Import Standardized",
      summary: "A queue standard and import flow were added to reduce rework and improve batch post consistency."
    },
    ja: {
      title: "[運用] cut queue 取込フローを標準化",
      summary: "キュー規約と取込手順を追加し、再作業を減らして一括投稿の品質を揃えました。"
    }
  },
  {
    date: "2026-04-24T12:00:00+08:00",
    zh: {
      title: "[数据质量] 内容标签与来源字段清理",
      summary: "针对既有内容进行标签与来源资料整修，改善搜索与分类质量。"
    },
    en: {
      title: "[Data Quality] Tags and Source Fields Cleaned",
      summary: "Existing content tags and source fields were cleaned up to improve search and category quality."
    },
    ja: {
      title: "[品質] タグとソース項目を整理",
      summary: "既存コンテンツのタグとソース情報を整備し、検索と分類の精度を改善しました。"
    }
  },
  {
    date: "2026-04-22T12:00:00+08:00",
    zh: {
      title: "[使用体验] 首页版型与模块排版微调",
      summary: "优化首页模块对齐与视觉一致性，提升浏览可读性与操作流畅度。"
    },
    en: {
      title: "[UX] Homepage Layout and Module Alignment Tuned",
      summary: "Homepage module alignment and visual consistency were refined for better readability and flow."
    },
    ja: {
      title: "[UX] ホームのレイアウトと整列を微調整",
      summary: "モジュール配置と視覚的一貫性を調整し、閲覧性と操作感を改善しました。"
    }
  }
];

const locales: Locale[] = ["zh-CN", "en", "ja"];

async function run() {
  const existingCount = await prisma.homepageBulletin.count();
  await prisma.homepageBulletin.deleteMany({});

  let created = 0;

  for (const locale of locales) {
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      const text = locale === "zh-CN" ? seed.zh : locale === "en" ? seed.en : seed.ja;
      await prisma.homepageBulletin.create({
        data: {
          locale,
          title: text.title,
          summary: text.summary,
          linkUrl: null,
          publishedAt: new Date(seed.date),
          startsAt: null,
          endsAt: null,
          isActive: true,
          isPinned: i === 0,
          sortOrder: i
        }
      });
      created += 1;
    }
  }

  console.log(JSON.stringify({ existingCount, created, perLocale: seeds.length }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
