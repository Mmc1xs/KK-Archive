import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProfileUsernameAction } from "@/app/actions";
import { requireUserWithoutTouch } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile";
import { formatDateTimeForLocale } from "@/lib/utils";

export default async function ProfileUsernamePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await requireUserWithoutTouch();
  const params = await searchParams;
  const profile = await getProfileData(sessionUser.id);
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  if (!profile) {
    notFound();
  }

  return (
    <div className="page-section grid">
      {success ? <div className="notice">{success}</div> : null}
      {error ? <div className="notice">{error}</div> : null}

      <section className="panel">
        <div className="split">
          <div>
            <div className="eyebrow">Username Settings</div>
            <h1 className="title-lg">Change Username</h1>
          </div>
          <div className="inline-actions">
            <span className="status">7-day cooldown</span>
            <Link href="/profile" className="link-pill">
              Back to Profile
            </Link>
          </div>
        </div>

        <div className="grid">
          <p className="muted">
            User identity, permissions, review records, and settlement tracking always stay bound to your internal user id. Changing
            username does not affect account authority.
          </p>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <article className="admin-stat-card">
              <span className="eyebrow">Current Username</span>
              <strong>{profile.user.username ?? "Not set"}</strong>
              <small>Lowercase letters, numbers, and underscores only</small>
            </article>
            <article className="admin-stat-card">
              <span className="eyebrow">Next Change</span>
              <strong>{profile.usernameChange.canChange ? "Available now" : formatDateTimeForLocale(profile.usernameChange.nextAvailableAt, "en-US")}</strong>
              <small>You can change your username once every 7 days</small>
            </article>
          </div>

          <form action={updateProfileUsernameAction} className="grid" style={{ gap: "14px" }}>
            <input type="hidden" name="redirectTo" value="/profile/username" />
            <label className="field">
              <span>New Username</span>
              <input
                type="text"
                name="username"
                defaultValue={profile.user.username ?? ""}
                minLength={3}
                maxLength={24}
                pattern="[a-z0-9_]+"
                placeholder="lowercase_username"
                disabled={!profile.usernameChange.canChange}
              />
            </label>
            <div className="inline-actions">
              <button type="submit" disabled={!profile.usernameChange.canChange}>
                Save Username
              </button>
              <span className="muted">Reserved names and duplicate usernames are blocked on the server.</span>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
