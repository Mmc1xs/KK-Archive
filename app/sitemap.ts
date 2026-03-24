import type { MetadataRoute } from "next";
import { PublishStatus } from "@prisma/client";
import { buildContentHref } from "@/lib/content-href";
import { db } from "@/lib/db";
import { getSiteOrigin } from "@/lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteOrigin = getSiteOrigin();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteOrigin}/`,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${siteOrigin}/contents`,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${siteOrigin}/search`,
      changeFrequency: "daily",
      priority: 0.8
    },
    {
      url: `${siteOrigin}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];

  const publicContents = await db.content.findMany({
    where: {
      publishStatus: PublishStatus.PUBLISHED
    },
    select: {
      slug: true,
      updatedAt: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const contentRoutes: MetadataRoute.Sitemap = publicContents.map((content) => ({
    url: `${siteOrigin}${buildContentHref(content.slug)}`,
    lastModified: content.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7
  }));

  return [...staticRoutes, ...contentRoutes];
}
