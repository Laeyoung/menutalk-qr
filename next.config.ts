import type { NextConfig } from "next";

// cacheComponents는 끈다: 모든 화면이 요청 시점 데이터(Blob)를 읽는 동적 구조이고,
// Spec이 쓰는 route segment config(runtime, maxDuration, dynamic)와 호환되지 않는다(DECISIONS D-10).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
