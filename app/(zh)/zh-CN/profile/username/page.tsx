import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateProfileUsernameAction } from "@/app/actions";
import { getCurrentSession } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile";
import { getLocaleLoginHref, getLocaleProfileHref, getLocaleProfileUsernameHref } from "@/lib/ui-locale";
import { formatDateTimeForLocale } from "@/lib/utils";

export default async function ProfileUsernamePageZhCn({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getCurrentSession({ touchActivity: false });
  if (!sessionUser) {
    redirect(getLocaleLoginHref("zh-CN"));
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
            <div className="eyebrow">用户名设置</div>
            <h1 className="title-lg">修改用户名</h1>
          </div>
          <div className="inline-actions">
            <span className="status">7 天冷却</span>
            <Link href={getLocaleProfileHref("zh-CN")} className="link-pill">
              返回档案
            </Link>
          </div>
        </div>

        <div className="grid">
          <p className="muted">
            用户身份、权限、审核记录与结算追踪始终绑定在内部 user id 上。修改用户名不会影响账号权限。
          </p>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <article className="admin-stat-card">
              <span className="eyebrow">当前用户名</span>
              <strong>{profile.user.username ?? "未设置"}</strong>
              <small>仅允许小写字母、数字与下划线</small>
            </article>
            <article className="admin-stat-card">
              <span className="eyebrow">下次可修改</span>
              <strong>{profile.usernameChange.canChange ? "现在可用" : formatDateTimeForLocale(profile.usernameChange.nextAvailableAt, "zh-CN")}</strong>
              <small>用户名每 7 天只能修改一次</small>
            </article>
          </div>

          <form action={updateProfileUsernameAction} className="grid" style={{ gap: "14px" }}>
            <input type="hidden" name="redirectTo" value={getLocaleProfileUsernameHref("zh-CN")} />
            <label className="field">
              <span>新用户名</span>
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
                保存用户名
              </button>
              <span className="muted">保留名称与重复用户名会在服务器端被拦截。</span>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
