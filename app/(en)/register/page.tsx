import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAuthCard } from "@/components/google-auth-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocaleHomeHref, getLocaleLoginHref } from "@/lib/ui-locale";

export default async function RegisterPage({
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
        title="Member Registration"
        description="New member accounts are created through Google sign-in only. Admin features remain restricted."
        actionLabel="Register with Google"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        Already linked? <Link href={getLocaleLoginHref("en")}>Login with Google</Link>
      </p>
    </>
  );
}
