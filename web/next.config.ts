import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Schlankes, eigenständiges Output-Bundle für das Docker-Image.
  output: "standalone",
};

export default nextConfig;
