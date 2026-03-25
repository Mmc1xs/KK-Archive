"use server";

import { ReviewStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff, requireUserWithoutTouch } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { HOMEPAGE_HOT_TOPIC_SLOT_COUNT, saveContent } from "@/lib/content";
import { deleteTag, saveTag, updateTag } from "@/lib/tag";
import { usernameSchema } from "@/lib/validation";

function redirectWithMessage(path: string, type: "error" | "success", message: string): never {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const params = new URLSearchParams({ [type]: message });
  const separator = safePath.includes("?") ? "&" : "?";
  redirect(`${safePath}${separator}${params.toString()}`);
}

export async function registerAction() {
  redirectWithMessage("/register", "error", "Manual registration is disabled. Please continue with Google.");
}

export async function loginAction() {
  redirectWithMessage("/login", "error", "Password login is disabled. Please continue with Google.");
}

function getIntList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export async function createContentAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const result = await saveContent({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    coverImageUrl: formData.get("coverImageUrl"),
    sourceLink: formData.get("sourceLink"),
    publishStatus: formData.get("publishStatus"),
    authorTagIds: getIntList(formData, "authorTagIds"),
    authorTagNames: getStringList(formData, "authorTagNames"),
    workTagIds: getIntList(formData, "workTagIds"),
    workTagNames: getStringList(formData, "workTagNames"),
    characterTagIds: getIntList(formData, "characterTagIds"),
    characterTagNames: getStringList(formData, "characterTagNames"),
    styleTagIds: getIntList(formData, "styleTagIds"),
    styleTagNames: getStringList(formData, "styleTagNames"),
    usageTagIds: getIntList(formData, "usageTagIds"),
    usageTagNames: getStringList(formData, "usageTagNames"),
    typeTagIds: getIntList(formData, "typeTagIds"),
    downloadLinks: getStringList(formData, "downloadLinks"),
    imageUrls: getStringList(formData, "imageUrls")
  }, undefined, {
    reviewStatusOverride: ReviewStatus.UNVERIFIED
  });

  if (!result.ok) {
    redirectWithMessage("/admin/contents/new", "error", result.error);
  }

  redirect("/admin/contents?success=Content created");
}

export async function updateContentAction(contentId: number, formData: FormData) {
  const staff = await requireStaff({ touchActivity: false });
  const reviewAction = String(formData.get("reviewAction") || "edited");
  const existing = await db.content.findUnique({
    where: { id: contentId },
    select: { reviewStatus: true }
  });

  if (!existing) {
    redirectWithMessage("/admin/contents", "error", "Content not found");
  }
  const reviewStatusOverride =
    staff.role === "ADMIN" && reviewAction === "passed"
      ? ReviewStatus.PASSED
      : ReviewStatus.EDITED;

  const result = await saveContent(
    {
      title: formData.get("title"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      coverImageUrl: formData.get("coverImageUrl"),
      sourceLink: formData.get("sourceLink"),
      publishStatus: formData.get("publishStatus"),
      authorTagIds: getIntList(formData, "authorTagIds"),
      authorTagNames: getStringList(formData, "authorTagNames"),
      workTagIds: getIntList(formData, "workTagIds"),
      workTagNames: getStringList(formData, "workTagNames"),
      characterTagIds: getIntList(formData, "characterTagIds"),
      characterTagNames: getStringList(formData, "characterTagNames"),
      styleTagIds: getIntList(formData, "styleTagIds"),
      styleTagNames: getStringList(formData, "styleTagNames"),
      usageTagIds: getIntList(formData, "usageTagIds"),
      usageTagNames: getStringList(formData, "usageTagNames"),
      typeTagIds: getIntList(formData, "typeTagIds"),
      downloadLinks: getStringList(formData, "downloadLinks"),
      imageUrls: getStringList(formData, "imageUrls")
    },
    contentId,
    {
      reviewStatusOverride,
      reviewHandledByUserId: reviewStatusOverride === ReviewStatus.EDITED ? staff.id : undefined,
      passHandledByUserId: reviewStatusOverride === ReviewStatus.PASSED ? staff.id : undefined
    }
  );

  if (!result.ok) {
    redirectWithMessage(`/admin/contents/${contentId}/edit`, "error", result.error);
  }

  redirect("/admin/contents?success=Content updated");
}

function getHomepageSlotRedirectPath(slot: number, type: "error" | "success", message: string) {
  return `/admin/homepage?slot=${slot}&${new URLSearchParams({ [type]: message }).toString()}`;
}

function parseHomepageSlot(formData: FormData) {
  const slot = Number(formData.get("slot"));
  if (!Number.isInteger(slot) || slot < 1 || slot > HOMEPAGE_HOT_TOPIC_SLOT_COUNT) {
    return null;
  }
  return slot;
}

export async function replaceHomepageHotTopicSlotAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const slot = parseHomepageSlot(formData);
  if (!slot) {
    redirectWithMessage("/admin/homepage", "error", "Invalid homepage slot");
  }

  const contentId = Number(formData.get("contentId"));
  if (!Number.isInteger(contentId) || contentId <= 0) {
    redirectWithMessage(`/admin/homepage?slot=${slot}`, "error", "Invalid content id");
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      publishStatus: true
    }
  });

  if (!content || content.publishStatus !== "PUBLISHED") {
    redirectWithMessage(`/admin/homepage?slot=${slot}`, "error", "Only published content can be featured");
  }

  await db.$transaction([
    db.homepageHotTopicSlot.deleteMany({
      where: {
        contentId
      }
    }),
    db.homepageHotTopicSlot.upsert({
      where: { slot },
      update: {
        contentId
      },
      create: {
        slot,
        contentId
      }
    })
  ]);

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  redirect(getHomepageSlotRedirectPath(slot, "success", "Hot Topic slot updated"));
}

export async function clearHomepageHotTopicSlotAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const slot = parseHomepageSlot(formData);
  if (!slot) {
    redirectWithMessage("/admin/homepage", "error", "Invalid homepage slot");
  }

  await db.homepageHotTopicSlot.delete({
    where: { slot }
  }).catch(() => null);

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  redirect(getHomepageSlotRedirectPath(slot, "success", "Hot Topic slot cleared"));
}

export async function createTagAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const result = await saveTag({
    name: formData.get("name"),
    slug: formData.get("slug"),
    type: formData.get("type")
  });

  if (!result.ok) {
    redirectWithMessage("/admin/tags", "error", result.error);
  }

  redirect("/admin/tags?success=Tag created");
}

export async function updateTagAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const tagId = Number(formData.get("tagId"));
  const redirectToRaw = String(formData.get("redirectTo") || "/admin/tags");
  const redirectTo =
    redirectToRaw.startsWith("/") && !redirectToRaw.startsWith("//") ? redirectToRaw : "/admin/tags";

  const result = await updateTag({
    tagId,
    name: formData.get("name"),
    slug: formData.get("slug")
  });

  if (!result.ok) {
    redirectWithMessage(redirectTo, "error", result.error);
  }

  redirectWithMessage("/admin/tags", "success", "Tag updated");
}

export async function deleteTagAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const tagId = Number(formData.get("tagId"));
  const redirectToRaw = String(formData.get("redirectTo") || "/admin/tags");
  const redirectTo =
    redirectToRaw.startsWith("/") && !redirectToRaw.startsWith("//") ? redirectToRaw : "/admin/tags";

  const result = await deleteTag(tagId);

  if (!result.ok) {
    redirectWithMessage(redirectTo, "error", result.error);
  }

  redirectWithMessage("/admin/tags", "success", "Tag deleted");
}

export async function deleteContentAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const contentId = Number(formData.get("contentId"));
  if (!Number.isInteger(contentId) || contentId <= 0) {
    redirect("/admin/contents?success=Invalid content id");
  }

  await db.content.delete({
    where: { id: contentId }
  });

  redirect("/admin/contents?success=Content deleted");
}

export async function transitionContentReviewStatusAction(formData: FormData) {
  const staff = await requireStaff({ touchActivity: false });
  const contentId = Number(formData.get("contentId"));
  const nextStatus = String(formData.get("nextStatus") || "");
  const redirectTo = String(formData.get("redirectTo") || "/admin/contents");

  if (!Number.isInteger(contentId) || contentId <= 0) {
    redirectWithMessage("/admin/contents", "error", "Invalid content id");
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    select: {
      reviewStatus: true,
      firstEditedByUserId: true
    }
  });

  if (!content) {
    redirectWithMessage("/admin/contents", "error", "Content not found");
  }
  const currentReviewStatus = content.reviewStatus;

  if (!Object.values(ReviewStatus).includes(nextStatus as ReviewStatus)) {
    redirectWithMessage("/admin/contents", "error", "Invalid review status");
  }

  const allowed =
    staff.role === "AUDIT"
      ? currentReviewStatus === ReviewStatus.UNVERIFIED && nextStatus === ReviewStatus.EDITED
      : nextStatus === ReviewStatus.UNVERIFIED ||
        nextStatus === ReviewStatus.EDITED ||
        nextStatus === ReviewStatus.PASSED;

  if (!allowed) {
    redirectWithMessage(redirectTo, "error", "You do not have permission to apply that review status");
  }

  const now = new Date();
  await db.content.update({
    where: { id: contentId },
    data: {
      reviewStatus: nextStatus as ReviewStatus,
      isVerified: nextStatus === ReviewStatus.PASSED,
      ...(nextStatus === ReviewStatus.UNVERIFIED
        ? {
            editedByUserId: null,
            editedAt: null,
            firstEditedByUserId: null,
            firstEditedAt: null,
            passedByUserId: null,
            passedAt: null
          }
        : nextStatus === ReviewStatus.EDITED
          ? {
              editedByUserId: staff.id,
              editedAt: now,
              ...(!content.firstEditedByUserId
                ? {
                    firstEditedByUserId: staff.id,
                    firstEditedAt: now
                  }
                : {}),
              passedByUserId: null,
              passedAt: null
            }
          : nextStatus === ReviewStatus.PASSED
            ? {
                passedByUserId: staff.id,
                passedAt: now
              }
          : {})
    }
  });

  const statusMessage =
    nextStatus === ReviewStatus.EDITED
      ? "Content moved to Edited"
      : nextStatus === ReviewStatus.PASSED
        ? "Content passed final review"
        : "Content reset to Unverified";

  redirectWithMessage(redirectTo, "success", statusMessage);
}

export async function toggleUserSuspendedAction(formData: FormData) {
  const admin = await requireAdmin({ touchActivity: false });
  const userId = Number(formData.get("userId"));
  const nextValue = formData.get("nextValue") === "true";
  const redirectTo = String(formData.get("redirectTo") || "/admin/activity");

  if (!Number.isInteger(userId) || userId <= 0) {
    redirectWithMessage("/admin/activity", "error", "Invalid user id");
  }

  if (admin.id === userId && nextValue) {
    redirectWithMessage("/admin/activity", "error", "You cannot suspend your own admin account");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      isSuspended: nextValue,
      suspendedAt: nextValue ? new Date() : null
    }
  });

  redirectWithMessage(redirectTo, "success", nextValue ? "Account suspended" : "Account unsuspended");
}

export async function updateUserRoleAction(formData: FormData) {
  const admin = await requireAdmin({ touchActivity: false });
  const userId = Number(formData.get("userId"));
  const nextRole = String(formData.get("nextRole") || "");
  const redirectTo = String(formData.get("redirectTo") || "/admin/activity");

  if (!Number.isInteger(userId) || userId <= 0) {
    redirectWithMessage("/admin/activity", "error", "Invalid user id");
  }

  if (nextRole !== UserRole.MEMBER && nextRole !== UserRole.AUDIT) {
    redirectWithMessage("/admin/activity", "error", "Invalid target role");
  }

  if (admin.id === userId) {
    redirectWithMessage("/admin/activity", "error", "You cannot change your own admin role");
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!targetUser) {
    redirectWithMessage("/admin/activity", "error", "User not found");
  }

  if (targetUser.role === UserRole.ADMIN) {
    redirectWithMessage("/admin/activity", "error", "Admin roles cannot be changed from this screen");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      role: nextRole as UserRole
    }
  });

  redirectWithMessage(redirectTo, "success", nextRole === UserRole.AUDIT ? "User promoted to audit" : "User set to member");
}

export async function updateUserSettlementQuantityAction(formData: FormData) {
  await requireAdmin({ touchActivity: false });

  const userId = Number(formData.get("userId"));
  const redirectTo = String(formData.get("redirectTo") || "/admin/activity");
  const nextValueRaw = String(formData.get("settlementQuantity") || "").trim();
  const nextValue = Number(nextValueRaw);

  if (!Number.isInteger(userId) || userId <= 0) {
    redirectWithMessage("/admin/activity", "error", "Invalid user id");
  }

  if (!Number.isInteger(nextValue) || nextValue < 0) {
    redirectWithMessage(redirectTo, "error", "Settlement Quantity must be a non-negative integer");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      settlementQuantity: nextValue
    }
  });

  redirectWithMessage(redirectTo, "success", "Settlement Quantity updated");
}

export async function updateProfileUsernameAction(formData: FormData) {
  const user = await requireUserWithoutTouch();
  const redirectTo = String(formData.get("redirectTo") || "/profile/username");
  const nextUsernameRaw = formData.get("username");
  const parsedUsername = usernameSchema.safeParse(nextUsernameRaw);

  if (!parsedUsername.success) {
    redirectWithMessage(redirectTo, "error", parsedUsername.error.issues[0]?.message ?? "Invalid username");
  }

  const nextUsername = parsedUsername.data;
  const currentUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      username: true,
      usernameUpdatedAt: true
    }
  });

  if (!currentUser) {
    redirectWithMessage(redirectTo, "error", "User not found");
  }

  if (currentUser.username === nextUsername) {
    redirectWithMessage(redirectTo, "success", "Username is already set to that value");
  }

  if (currentUser.usernameUpdatedAt) {
    const nextAvailableAt = new Date(currentUser.usernameUpdatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (nextAvailableAt.getTime() > Date.now()) {
      redirectWithMessage(
        redirectTo,
        "error",
        `Username can only be changed once every 7 days. Next available: ${nextAvailableAt.toLocaleString("zh-TW")}`
      );
    }
  }

  const existingUser = await db.user.findUnique({
    where: { username: nextUsername },
    select: { id: true }
  });

  if (existingUser && existingUser.id !== user.id) {
    redirectWithMessage(redirectTo, "error", "That username is already taken");
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      username: nextUsername,
      usernameUpdatedAt: new Date()
    }
  });

  redirectWithMessage(redirectTo, "success", "Username updated");
}
