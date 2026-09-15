import type { MetadataRoute } from "next";
import { CATEGORIES, getCategorySlug, TOOLS } from "@/lib/tools";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

const HERO = new Set(["pdf-compressor", "pdf-merge", "pdf-split", "pdf-editor"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const toolUrls: MetadataRoute.Sitemap = TOOLS.map((tool) => ({
    url: `${SITE_URL}/tools/${tool.slug}`,
    lastModified: new Date(),
    changeFrequency: HERO.has(tool.slug) ? "weekly" : "monthly",
    priority: HERO.has(tool.slug) ? 0.9 : 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: `${SITE_URL}/categories/${getCategorySlug(category)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const guideUrls: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    lastModified: new Date(guide.updated),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/guides`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/verify`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...categoryUrls,
    ...toolUrls,
    ...guideUrls,
  ];
}