"use server";

import { ReviewStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { saveContent } from "@/lib/content";
import { saveTag } from "@/lib/tag";

function redirectWithMessage(path: string, type: "error" | "success", message: string): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`${path}?${params.toString()}`);
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
  await requireAdmin();

  const result = await saveContent({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    coverImageUrl: formData.get("coverImageUrl"),
    publishStatus: formData.get("publishStatus"),
    authorTagIds: getIntList(formData, "authorTagIds"),
    authorTagNames: getStringList(formData, "authorTagNames"),
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
  const staff = await requireStaff();
  const existing = await db.content.findUnique({
    where: { id: contentId },
    select: { reviewStatus: true }
  });

  if (!existing) {
    redirectWithMessage("/admin/contents", "error", "Content not found");
  }
  const currentReviewStatus = existing.reviewStatus;

  const reviewStatusOverride =
    staff.role === "AUDIT" ? ReviewStatus.EDITED : currentReviewStatus;

  const result = await saveContent(
    {
      title: formData.get("title"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      coverImageUrl: formData.get("coverImageUrl"),
      publishStatus: formData.get("publishStatus"),
      authorTagIds: getIntList(formData, "authorTagIds"),
      authorTagNames: getStringList(formData, "authorTagNames"),
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
      reviewStatusOverride
    }
  );

  if (!result.ok) {
    redirectWithMessage(`/admin/contents/${contentId}/edit`, "error", result.error);
  }

  redirect("/admin/contents?success=Content updated");
}

export async function createTagAction(formData: FormData) {
  await requireAdmin();

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

export async function deleteContentAction(formData: FormData) {
  await requireAdmin();

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
  const staff = await requireStaff();
  const contentId = Number(formData.get("contentId"));
  const nextStatus = String(formData.get("nextStatus") || "");
  const redirectTo = String(formData.get("redirectTo") || "/admin/contents");

  if (!Number.isInteger(contentId) || contentId <= 0) {
    redirectWithMessage("/admin/contents", "error", "Invalid content id");
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    select: { reviewStatus: true }
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

  await db.content.update({
    where: { id: contentId },
    data: {
      reviewStatus: nextStatus as ReviewStatus,
      isVerified: nextStatus === ReviewStatus.PASSED
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
