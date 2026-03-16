import Link from "next/link";
import { GoogleAuthCard } from "@/components/google-auth-card";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      <GoogleAuthCard
        title="Member Login"
        description="Members now sign in with Google only. Public browsing still focuses on published content."
        actionLabel="Continue with Google"
        error={error}
      />
      <p className="muted" style={{ textAlign: "center", marginTop: -24 }}>
        Need access? <Link href="/register">Register with Google</Link>
      </p>
    </>
  );
}
