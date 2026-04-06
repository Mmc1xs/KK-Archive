import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAuthCard } from "@/components/google-auth-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocaleHomeHref, getLocaleRegisterHref } from "@/lib/ui-locale";

export default async function LoginPageJa({
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
        title="メンバーログイン"
        description="メンバーは現在 Google ログインのみ対応しています。公開閲覧は引き続き公開済みコンテンツ中心です。"
        actionLabel="Google で続行"
        helperText="Google 認証済みアカウントのみログインできます。初回成功時にメンバーアカウントが自動で作成または連携されます。"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        アクセスが必要ですか？ <Link href={getLocaleRegisterHref("ja")}>Google で登録</Link>
      </p>
    </>
  );
}
