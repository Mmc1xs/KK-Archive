import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAuthCard } from "@/components/google-auth-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocaleHomeHref, getLocaleLoginHref } from "@/lib/ui-locale";

export default async function RegisterPageZhCn({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentSession({ touchActivity: false });

  if (user) {
    redirect(user.role === "ADMIN" || user.role === "AUDIT" ? "/admin" : getLocaleHomeHref("zh-CN"));
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      <GoogleAuthCard
        eyebrow="会员入口"
        title="会员注册"
        description="新会员账号目前仅能通过 Google 登录创建，管理功能仍保持受限。"
        actionLabel="使用 Google 注册"
        helperText="只有通过 Google 验证的账号可以登录。首次成功登录时，系统会自动创建或关联你的会员账号。"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        已经绑定？ <Link href={getLocaleLoginHref("zh-CN")}>使用 Google 登录</Link>
      </p>
    </>
  );
}
