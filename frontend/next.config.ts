import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ffmpeg-static resolves its executable at runtime. Explicit tracing keeps the
  // native binary beside the package when Next builds a standalone deployment.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/batch-process": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
}

export default nextConfig
