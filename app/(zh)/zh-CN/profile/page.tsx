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
        label: "编辑数量",
        value: String(metrics.editedCount),
        help: "此账号当前被记录为 Edited 的内容数量。"
      }
    ] satisfies ProfileMetric[];
  }

  return [
    {
      label: "编辑数量",
      value: String(metrics.editedCount),
      help: "此账号当前被记录为 Edited 的内容数量。"
    },
    {
      label: "通过数量",
      value: String(metrics.passedCount),
      help: "此账号当前最终标记为 Passed 的内容数量。"
    },
    {
      label: "结算数量",
      value: String(metrics.settlementQuantity),
      help: "由管理员控制的结算数量，与 Passed Count 分开记录。",
      tone: "strong"
    }
  ] satisfies ProfileMetric[];
}

function buildProfileSlots(role: UserRole): ProfileSlot[] {
  if (role === UserRole.ADMIN) {
    return [
      {
        title: "结算面板预留位",
        description: "预留给结算明细、付款批次或月度核对功能。"
      },
      {
        title: "管理控制预留位",
        description: "预留给创作者审批、账务控制或未来运营工具。"
      }
    ];
  }

  if (role === UserRole.AUDIT) {
    return [
      {
        title: "结算规则预留位",
        description: "预留给未来结算规则或工作指引，同时不暴露管理员专用总量。"
      },
      {
        title: "创作者工具桥接位",
        description: "预留给未来创作者入口，避免把账号页挤得过满。"
      }
    ];
  }

  return [
    {
      title: "预留位 A",
      description: "随着会员体验成长，这里可放未来的账号级工具。"
    },
    {
      title: "预留位 B",
      description: "预留给未来模块，避免基础个人页被迫重新设计。"
    }
  ];
}

export default async function ProfilePageZhCn({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getCurrentSession({ touchActivity: false });
  if (!sessionUser) {
    redirect(getLocaleLoginHref("zh-CN"));
  }

  const profile = await getProfileData(sessionUser.id);
  await searchParams;

  if (!profile) {
    notFound();
  }

  return (
    <div className="page-section">
      <ProfileView
        eyebrow="账号档案"
        title={`${profile.user.username ?? profile.user.email} 的档案`}
        role={profile.user.role}
        status={profile.user.isSuspended ? "已停用" : "正常"}
        identity={[
          {
            label: "用户名",
            value: profile.user.username ?? "未设置",
            actionLabel: "修改",
            actionHref: getLocaleProfileUsernameHref("zh-CN")
          },
          { label: "邮箱", value: profile.user.email },
          { label: "加入时间", value: formatDateTimeForLocale(profile.user.createdAt, "zh-CN") },
          { label: "账号状态", value: profile.user.isSuspended ? "已停用" : "正常" }
        ]}
        metrics={buildProfileMetrics(profile.user.role, profile.metrics)}
        slots={buildProfileSlots(profile.user.role)}
        labels={{
          profileIdentity: "档案身份",
          profileIdentityHelp: "先把账号记录保持清晰，头像与社交模块可以后续再补。",
          accountDetails: "账号详情",
          accountDetailsHelp: "所有已登录账号都能看到的稳定身份资料。",
          staffMetrics: "工作人员统计",
          staffMetricsHelp: "基于角色的工作数字，会员不会看到这一区。",
          extensionSlots: "扩展预留位",
          extensionSlotsHelp: "预留给结算、创作者工具、账务或未来内部面板。",
          reserved: "预留",
          scalabilityNotes: "扩展说明",
          scalabilityNotesHelp: "这个结构能让未来扩充更低成本。",
          noteItems: [
            "身份、工作人员统计与扩展预留位彼此分离，新功能不会逼着整页重做。",
            "Settlement Quantity 与 Passed Count 独立，管理员可调整结算数量而不影响审核历史。",
            "未来的创作者工具可以直接接到预留区，不会挤占账号核心内容。"
          ]
        }}
      />
    </div>
  );
}
