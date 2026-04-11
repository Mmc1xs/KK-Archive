import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAuthCard } from "@/components/google-auth-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocaleHomeHref, getLocaleRegisterHref } from "@/lib/ui-locale";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentSession({ touchActivity: false });

  if (user) {
    redirect(user.role === "ADMIN" || user.role === "AUDIT" ? "/admin" : getLocaleHomeHref("en"));
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      <GoogleAuthCard
        eyebrow="Member Access"
        title="Member Login"
        description="Members now sign in with Google only. Public browsing still focuses on published content."
        actionLabel="Continue with Google"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        Need access? <Link href={getLocaleRegisterHref("en")}>Register with Google</Link>
      </p>
    </>
  );
}
