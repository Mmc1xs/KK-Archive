import { UserRole } from "@prisma/client";
import { ProfileMetric, ProfileView } from "@/components/profile-view";
import styles from "./page.module.css";

function buildDemoMetrics(role: UserRole, metrics: { editedCount: number; passedCount: number; settlementQuantity: number }) {
  if (role === UserRole.MEMBER) {
    return undefined;
  }

  if (role === UserRole.AUDIT) {
    return [
      {
        label: "Edited Count",
        value: String(metrics.editedCount),
        help: "Displays the number of items handled to Edited by this audit account."
      }
    ] satisfies ProfileMetric[];
  }

  return [
    {
      label: "Edited Count",
      value: String(metrics.editedCount),
      help: "Displays the number of items handled to Edited by this admin account."
    },
    {
      label: "Passed Count",
      value: String(metrics.passedCount),
      help: "Displays the number of items finally passed by this admin account."
    },
    {
      label: "Settlement Quantity",
      value: String(metrics.settlementQuantity),
      help: "Admin-managed settled quantity that stays independent from Passed Count.",
      tone: "strong"
    }
  ] satisfies ProfileMetric[];
}

export default function ProfileDemoPage() {
  return (
    <div className={styles.page}>
      <section className="hero">
        <div className={styles.heroIntro}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Profile Demo</p>
            <h1 className={styles.heroTitle}>Profile structure demo</h1>
            <p className="muted">
              This preview keeps the profile focused on account identity, role-based work metrics, and reserved extension slots.
            </p>
          </div>
          <div className={styles.heroChecklist}>
            <div className={styles.heroChecklistCard}>
              <strong>Confirmed constraints</strong>
              <ul className={styles.checkList}>
                <li>Members do not see audit/admin work data.</li>
                <li>Audit only sees Edited Count.</li>
                <li>Admin sees Edited Count, Passed Count, and Settlement Quantity.</li>
                <li>Future creator and billing features plug into reserved slots.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.stack}>
        <ProfileView
          eyebrow="Reference A"
          title="Member Profile"
          role="MEMBER"
          status="Active"
          identity={[
            { label: "Username", value: "member_sample" },
            { label: "Email", value: "member@example.com" },
            { label: "Joined At", value: "2026/03/01 09:00" },
            { label: "Account Status", value: "Normal" }
          ]}
          slots={[
            {
              title: "Reserved Slot A",
              description: "Reserved for future account-level tools without forcing social features into the base profile."
            },
            {
              title: "Reserved Slot B",
              description: "Reserved for future member modules without crowding the identity core."
            }
          ]}
        />

        <ProfileView
          eyebrow="Reference B"
          title="Audit Profile"
          role="AUDIT"
          status="Staff Active"
          identity={[
            { label: "Username", value: "audit_sample" },
            { label: "Email", value: "audit@example.com" },
            { label: "Joined At", value: "2026/01/18 12:30" },
            { label: "Account Status", value: "Normal" }
          ]}
          metrics={buildDemoMetrics(UserRole.AUDIT, {
            editedCount: 184,
            passedCount: 0,
            settlementQuantity: 0
          })}
          slots={[
            {
              title: "Settlement Rules Slot",
              description: "Reserved for future payout rule explanations without exposing admin-only numbers."
            },
            {
              title: "Creator Tools Bridge",
              description: "Reserved for the future creator interface entry point without disturbing the profile core."
            }
          ]}
        />

        <ProfileView
          eyebrow="Reference C"
          title="Admin Profile"
          role="ADMIN"
          status="Admin Active"
          identity={[
            { label: "Username", value: "admin_sample" },
            { label: "Email", value: "admin@example.com" },
            { label: "Joined At", value: "2025/10/08 10:20" },
            { label: "Account Status", value: "Normal" }
          ]}
          metrics={buildDemoMetrics(UserRole.ADMIN, {
            editedCount: 312,
            passedCount: 127,
            settlementQuantity: 68
          })}
          slots={[
            {
              title: "Settlement Panel Slot",
              description: "Reserved for settlement details, payment batches, or monthly reconciliation."
            },
            {
              title: "Admin Control Slot",
              description: "Reserved for creator approval, billing controls, or future operations tools."
            }
          ]}
        />
      </div>
    </div>
  );
}
