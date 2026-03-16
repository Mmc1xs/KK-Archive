import Link from "next/link";
import { GoogleAuthCard } from "@/components/google-auth-card";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      <GoogleAuthCard
        title="Member Registration"
        description="New member accounts are created through Google sign-in only. Admin features remain restricted."
        actionLabel="Register with Google"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        Already linked? <Link href="/login">Login with Google</Link>
      </p>
    </>
  );
}
