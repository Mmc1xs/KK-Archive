import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAuthCard } from "@/components/google-auth-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocaleHomeHref, getLocaleLoginHref } from "@/lib/ui-locale";

export default async function RegisterPageJa({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentSession({ touchActivity: false });

  if (user) {
    redirect(user.role === "ADMIN" || user.role === "AUDIT" ? "/admin" : getLocaleHomeHref("ja"));
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      <GoogleAuthCard
        eyebrow="メンバー入口"
        title="メンバー登録"
        description="新しいメンバーアカウントは現在 Google ログイン経由でのみ作成されます。管理機能は引き続き制限されています。"
        actionLabel="Google で登録"
        helperText="Google 認証済みアカウントのみログインできます。初回成功時にメンバーアカウントが自動で作成または連携されます。"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        すでに連携済みですか？ <Link href={getLocaleLoginHref("ja")}>Google でログイン</Link>
      </p>
    </>
  );
}
