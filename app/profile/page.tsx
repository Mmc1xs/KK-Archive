import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ProfileMetric, ProfileSlot, ProfileView } from "@/components/profile-view";
import { requireUserWithoutTouch } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile";
import { formatDateTimeForLocale } from "@/lib/utils";

function buildProfileMetrics(role: UserRole, metrics: { editedCount: number; passedCount: number; settlementQuantity: number }) {
  if (role === UserRole.MEMBER) {
    return undefined;
  }

  if (role === UserRole.AUDIT) {
    return [
      {
        label: "Edited Count",
        value: String(metrics.editedCount),
        help: "Content currently recorded as reviewed to Edited by this account."
      }
    ] satisfies ProfileMetric[];
  }

  return [
    {
      label: "Edited Count",
      value: String(metrics.editedCount),
      help: "Content currently recorded as reviewed to Edited by this account."
    },
    {
      label: "Passed Count",
      value: String(metrics.passedCount),
      help: "Content currently recorded as finally passed by this account."
    },
    {
      label: "Settlement Quantity",
      value: String(metrics.settlementQuantity),
      help: "Admin-controlled settled quantity. This is separate from Passed Count.",
      tone: "strong"
    }
  ] satisfies ProfileMetric[];
}

function buildProfileSlots(role: UserRole): ProfileSlot[] {
  if (role === UserRole.ADMIN) {
    return [
      {
        title: "Settlement Panel Slot",
        description: "Reserved for settlement details, payment batches, or monthly reconciliation."
      },
      {
        title: "Admin Control Slot",
        description: "Reserved for creator approval, billing controls, or future operations tools."
      }
    ];
  }

  if (role === UserRole.AUDIT) {
    return [
      {
        title: "Settlement Rules Slot",
        description: "Reserved for future payout rules or work guidance without exposing admin-only totals."
      },
      {
        title: "Creator Tools Bridge",
        description: "Reserved for the future creator interface entry point without crowding the account page."
      }
    ];
  }

  return [
    {
      title: "Reserved Slot A",
      description: "Reserved for future account-level tools once the member experience grows."
    },
    {
      title: "Reserved Slot B",
      description: "Reserved for future modules without forcing a redesign of the base profile."
    }
  ];
}

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await requireUserWithoutTouch();
  const profile = await getProfileData(sessionUser.id);
  await searchParams;

  if (!profile) {
    notFound();
  }

  return (
    <div className="page-section">
      <ProfileView
        eyebrow="Account Profile"
        title={`${profile.user.username ?? profile.user.email} Profile`}
        role={profile.user.role}
        status={profile.user.isSuspended ? "Suspended" : "Active"}
        identity={[
          {
            label: "Username",
            value: profile.user.username ?? "Not set",
            actionLabel: "Change",
            actionHref: "/profile/username"
          },
          { label: "Email", value: profile.user.email },
          { label: "Joined At", value: formatDateTimeForLocale(profile.user.createdAt, "en-US") },
          { label: "Account Status", value: profile.user.isSuspended ? "Suspended" : "Normal" }
        ]}
        metrics={buildProfileMetrics(profile.user.role, profile.metrics)}
        slots={buildProfileSlots(profile.user.role)}
        labels={{
          profileIdentity: "Profile Identity",
          profileIdentityHelp: "Keep the account record clear first. Avatar and social modules can come later.",
          accountDetails: "Account Details",
          accountDetailsHelp: "Stable identity data that every signed-in account can see.",
          staffMetrics: "Staff Metrics",
          staffMetricsHelp: "Role-based work numbers. Members do not see this area.",
          extensionSlots: "Extension Slots",
          extensionSlotsHelp: "Reserved modules for settlement, creator tools, billing, or future internal panels.",
          reserved: "Reserved",
          scalabilityNotes: "Scalability Notes",
          scalabilityNotesHelp: "This structure keeps future expansion cheap.",
          noteItems: [
            "Identity, staff metrics, and extension slots are separated, so new features do not force a full page redesign.",
            "Settlement Quantity is independent from Passed Count and can be adjusted by admin without touching moderation history.",
            "Future creator tools can plug into reserved slots instead of crowding the account core."
          ]
        }}
      />
    </div>
  );
}
