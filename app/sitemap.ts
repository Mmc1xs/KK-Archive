import type { MetadataRoute } from "next";
import { PublishStatus } from "@prisma/client";
import { buildContentHref } from "@/lib/content-href";
import { db } from "@/lib/db";
import { getSiteOrigin } from "@/lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteOrigin = getSiteOrigin();
  const localizedPrefixes = ["ja", "zh-CN"] as const;

  const staticRouteEntries: Array<{
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
    priority: number;
  }> = [
    {
      path: "/",
      changeFrequency: "daily",
      priority: 1
    },
    {
      path: "/contents",
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      path: "/search",
      changeFrequency: "daily",
      priority: 0.8
    },
    {
      path: "/about",
      changeFrequency: "monthly",
      priority: 0.4
    },
    {
      path: "/contact",
      changeFrequency: "monthly",
      priority: 0.4
    },
    {
      path: "/terms",
      changeFrequency: "monthly",
      priority: 0.4
    },
    {
      path: "/support",
      changeFrequency: "monthly",
      priority: 0.3
    },
    {
      path: "/privacy",
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];

  const staticRoutes: MetadataRoute.Sitemap = [
    ...staticRouteEntries.map((route) => ({
      url: `${siteOrigin}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority
    })),
    ...localizedPrefixes.flatMap((prefix) =>
      staticRouteEntries.map((route) => ({
        url: route.path === "/" ? `${siteOrigin}/${prefix}` : `${siteOrigin}/${prefix}${route.path}`,
        changeFrequency: route.changeFrequency,
        priority: route.priority
      }))
    )
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
