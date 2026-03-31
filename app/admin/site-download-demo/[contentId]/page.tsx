import { notFound } from "next/navigation";
import { SiteDownloadDemoStatus } from "@prisma/client";
import { SiteDownloadDemoPanel } from "@/components/admin/site-download-demo-panel";
import { requireAdmin } from "@/lib/auth/session";
import {
  getSiteDownloadDemoContent,
  inspectSiteDownloadDemoSource,
  listDetectedSiteDownloadR2Objects
} from "@/lib/demo/site-download";

export default async function AdminSiteDownloadDemoDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin({ touchActivity: false });
  const routeParams = await params;
  const contentId = Number(routeParams.contentId);
  const query = await searchParams;

  if (!Number.isInteger(contentId) || contentId <= 0) {
    notFound();
  }

  const content = await getSiteDownloadDemoContent(contentId);
  if (!content) {
    notFound();
  }

  let inspectResult = null;
  let inspectError: string | null = null;
  let detectedObjects: Awaited<ReturnType<typeof listDetectedSiteDownloadR2Objects>> = [];

  if (content.telegramSourceUrl) {
    detectedObjects = await listDetectedSiteDownloadR2Objects(contentId);
  }

  if (
    content.telegramSourceUrl &&
    content.siteDownloadDemo?.status !== SiteDownloadDemoStatus.IGNORED &&
    content.siteDownloadDemo?.status !== SiteDownloadDemoStatus.UPLOADED
  ) {
    try {
      inspectResult = await inspectSiteDownloadDemoSource(content.telegramSourceUrl);
    } catch (error) {
      inspectError = error instanceof Error ? error.message : "Failed to inspect the Telegram source message";
    }
  }

  return (
    <div className="page-section admin-layout">
      <SiteDownloadDemoPanel
        content={content}
        inspectResult={inspectResult}
        inspectError={inspectError}
        detectedObjects={detectedObjects}
        success={typeof query.success === "string" ? query.success : undefined}
        error={typeof query.error === "string" ? query.error : undefined}
      />
    </div>
  );
}
