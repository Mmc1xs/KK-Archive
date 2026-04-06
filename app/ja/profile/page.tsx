import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ProfileMetric, ProfileSlot, ProfileView } from "@/components/profile-view";
import { getCurrentSession } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile";
import { getLocaleLoginHref, getLocaleProfileUsernameHref } from "@/lib/ui-locale";
import { formatDateTimeForLocale } from "@/lib/utils";

function buildProfileMetrics(role: UserRole, metrics: { editedCount: number; passedCount: number; settlementQuantity: number }) {
  if (role === UserRole.MEMBER) {
    return undefined;
  }

  if (role === UserRole.AUDIT) {
    return [
      {
        label: "編集数",
        value: String(metrics.editedCount),
        help: "このアカウントで Edited として記録されている件数です。"
      }
    ] satisfies ProfileMetric[];
  }

  return [
    {
      label: "編集数",
      value: String(metrics.editedCount),
      help: "このアカウントで Edited として記録されている件数です。"
    },
    {
      label: "承認数",
      value: String(metrics.passedCount),
      help: "このアカウントで最終的に Passed と記録されている件数です。"
    },
    {
      label: "精算数量",
      value: String(metrics.settlementQuantity),
      help: "管理者が管理する精算数量です。Passed Count とは別管理です。",
      tone: "strong"
    }
  ] satisfies ProfileMetric[];
}

function buildProfileSlots(role: UserRole): ProfileSlot[] {
  if (role === UserRole.ADMIN) {
    return [
      {
        title: "精算パネル枠",
        description: "精算詳細、支払いバッチ、月次照合などの将来枠です。"
      },
      {
        title: "管理操作枠",
        description: "クリエイター承認、請求管理、将来の運用ツール向けの枠です。"
      }
    ];
  }

  if (role === UserRole.AUDIT) {
    return [
      {
        title: "精算ルール枠",
        description: "管理者専用合計を見せずに、将来の精算ルールや作業ガイドを置く枠です。"
      },
      {
        title: "クリエイターツール接続枠",
        description: "将来のクリエイターUI入口を置くための枠です。"
      }
    ];
  }

  return [
    {
      title: "予約枠 A",
      description: "会員向け機能が増えた時のためのアカウント機能枠です。"
    },
    {
      title: "予約枠 B",
      description: "基本プロフィールを崩さずに将来機能を追加するための枠です。"
    }
  ];
}

export default async function ProfilePageJa({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getCurrentSession({ touchActivity: false });
  if (!sessionUser) {
    redirect(getLocaleLoginHref("ja"));
  }

  const profile = await getProfileData(sessionUser.id);
  await searchParams;

  if (!profile) {
    notFound();
  }

  return (
    <div className="page-section">
      <ProfileView
        eyebrow="アカウントプロフィール"
        title={`${profile.user.username ?? profile.user.email} のプロフィール`}
        role={profile.user.role}
        status={profile.user.isSuspended ? "停止中" : "有効"}
        identity={[
          {
            label: "ユーザー名",
            value: profile.user.username ?? "未設定",
            actionLabel: "変更",
            actionHref: getLocaleProfileUsernameHref("ja")
          },
          { label: "メール", value: profile.user.email },
          { label: "登録日時", value: formatDateTimeForLocale(profile.user.createdAt, "ja-JP") },
          { label: "アカウント状態", value: profile.user.isSuspended ? "停止中" : "通常" }
        ]}
        metrics={buildProfileMetrics(profile.user.role, profile.metrics)}
        slots={buildProfileSlots(profile.user.role)}
        labels={{
          profileIdentity: "プロフィール情報",
          profileIdentityHelp: "まずはアカウント記録を明確に保ち、アバターやSNS機能は後から追加できます。",
          accountDetails: "アカウント詳細",
          accountDetailsHelp: "ログイン済みアカウント全員が見られる安定した情報です。",
          staffMetrics: "スタッフ指標",
          staffMetricsHelp: "役割に応じた作業数です。メンバーには表示されません。",
          extensionSlots: "拡張予約枠",
          extensionSlotsHelp: "精算、クリエイターツール、請求、将来の内部パネル向けの予約枠です。",
          reserved: "予約",
          scalabilityNotes: "拡張メモ",
          scalabilityNotesHelp: "この構造なら将来の拡張コストを抑えられます。",
          noteItems: [
            "本人情報、スタッフ指標、拡張枠を分けているため、新機能追加でページ全体を作り直す必要がありません。",
            "Settlement Quantity は Passed Count と独立しており、管理者は審査履歴を崩さずに調整できます。",
            "将来のクリエイターツールは予約枠に接続でき、アカウント本体を圧迫しません。"
          ]
        }}
      />
    </div>
  );
}
