import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img.openagenda.com",
      },
      {
        protocol: "https",
        hostname: "www.univ-orleans.fr",
      },
      {
        protocol: "https",
        hostname: "www.billetweb.fr",
      },
    ],
  },
};

export default nextConfig;
