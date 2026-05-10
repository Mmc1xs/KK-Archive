import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        has: [
          {
            type: "cookie",
            key: "kk_locale_pref",
            value: "en"
          }
        ],
        destination: "/en",
        permanent: false
      },
      {
        source: "/",
        has: [
          {
            type: "cookie",
            key: "kk_locale_pref",
            value: "ja"
          }
        ],
        destination: "/ja",
        permanent: false
      },
      {
        source: "/",
        destination: "/zh-CN",
        permanent: false
      }
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
