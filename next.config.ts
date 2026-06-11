import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["sixties-rover-overcook.ngrok-free.dev"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client"],
};

export default nextConfig;
