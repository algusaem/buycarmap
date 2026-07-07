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
        hostname: "**.wallapop.com",
      },
      {
        protocol: "https",
        hostname: "**.ccdn.es",
      },
    ],
  },
};

export default nextConfig;
