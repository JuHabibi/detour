import type { MetadataRoute } from "next";
import { publicRobotsHost, publicRobotsSitemapUrl } from "@/config/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/frise", "/api/", "/__"],
    },
    sitemap: publicRobotsSitemapUrl(),
    host: publicRobotsHost(),
  };
}
