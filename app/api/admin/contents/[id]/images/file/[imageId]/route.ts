import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteR2Object, extractR2ObjectKeyFromPublicUrl } from "@/lib/storage/r2";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const user = await getCurrentSession({ touchActivity: false });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routeParams = await params;
  const contentId = Number(routeParams.id);
  const imageId = Number(routeParams.imageId);
  if (!Number.isInteger(contentId) || contentId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
    return NextResponse.json({ error: "Invalid image target" }, { status: 400 });
  }

  const contentImage = await db.contentImage.findFirst({
    where: {
      id: imageId,
      contentId
    },
    select: {
      id: true,
      imageUrl: true,
      content: {
        select: {
          slug: true,
          coverImageUrl: true
        }
      }
    }
  });

  if (!contentImage) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (contentImage.imageUrl === contentImage.content.coverImageUrl) {
    return NextResponse.json({ error: "Cover image is managed separately" }, { status: 409 });
  }

  await db.contentImage.delete({
    where: {
      id: contentImage.id
    }
  });

  let storageCleanupWarning: string | null = null;
  const objectKey = extractR2ObjectKeyFromPublicUrl(contentImage.imageUrl);
  if (objectKey) {
    try {
      await deleteR2Object(objectKey);
    } catch (error) {
      console.error("Failed to delete content image from R2", {
        contentId,
        imageId: contentImage.id,
        objectKey,
        error
      });
      storageCleanupWarning = "Image metadata was removed, but R2 cleanup failed. Please check storage manually.";
    }
  }

  revalidatePath(`/admin/contents/${contentId}/edit`);
  revalidatePath(`/contents/${contentImage.content.slug}`);
  revalidatePath(`/zh-CN/contents/${contentImage.content.slug}`);
  revalidatePath(`/ja/contents/${contentImage.content.slug}`);

  return NextResponse.json({
    removedImageId: contentImage.id,
    removedImageUrl: contentImage.imageUrl,
    warning: storageCleanupWarning
  });
}
