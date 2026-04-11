import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateProfileUsernameAction } from "@/app/actions";
import { getCurrentSession } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile";
import { getLocaleLoginHref, getLocaleProfileHref, getLocaleProfileUsernameHref } from "@/lib/ui-locale";
import { formatDateTimeForLocale } from "@/lib/utils";

export default async function ProfileUsernamePageJa({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getCurrentSession({ touchActivity: false });
  if (!sessionUser) {
    redirect(getLocaleLoginHref("ja"));
  }

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
            <div className="eyebrow">ユーザー名設定</div>
            <h1 className="title-lg">ユーザー名を変更</h1>
          </div>
          <div className="inline-actions">
            <span className="status">7日クールダウン</span>
            <Link href={getLocaleProfileHref("ja")} className="link-pill">
              プロフィールに戻る
            </Link>
          </div>
        </div>

        <div className="grid">
          <p className="muted">
            本人情報、権限、審査記録、精算追跡は常に内部 user id に紐づいています。ユーザー名を変更してもアカウント権限には影響しません。
          </p>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <article className="admin-stat-card">
              <span className="eyebrow">現在のユーザー名</span>
              <strong>{profile.user.username ?? "未設定"}</strong>
              <small>小文字英字、数字、アンダースコアのみ使用できます</small>
            </article>
            <article className="admin-stat-card">
              <span className="eyebrow">次回変更可能日</span>
              <strong>{profile.usernameChange.canChange ? "今すぐ変更可能" : formatDateTimeForLocale(profile.usernameChange.nextAvailableAt, "ja-JP")}</strong>
              <small>ユーザー名は7日に1回だけ変更できます</small>
            </article>
          </div>

          <form action={updateProfileUsernameAction} className="grid" style={{ gap: "14px" }}>
            <input type="hidden" name="redirectTo" value={getLocaleProfileUsernameHref("ja")} />
            <label className="field">
              <span>新しいユーザー名</span>
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
                ユーザー名を保存
              </button>
              <span className="muted">予約名や重複ユーザー名はサーバー側で拒否されます。</span>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
