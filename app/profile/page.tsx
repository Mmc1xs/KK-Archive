import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ProfileMetric, ProfileSlot, ProfileView } from "@/components/profile-view";
import { requireUserWithoutTouch } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile";
import { formatDateTime } from "@/lib/utils";

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

export default async function ProfilePage() {
  const sessionUser = await requireUserWithoutTouch();
  const profile = await getProfileData(sessionUser.id);

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
          { label: "Username", value: profile.user.username ?? "Not set" },
          { label: "Email", value: profile.user.email },
          { label: "Joined At", value: formatDateTime(profile.user.createdAt) },
          { label: "Account Status", value: profile.user.isSuspended ? "Suspended" : "Normal" }
        ]}
        metrics={buildProfileMetrics(profile.user.role, profile.metrics)}
        slots={buildProfileSlots(profile.user.role)}
      />
    </div>
  );
}
