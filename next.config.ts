import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // firebase-admin's auth module pulls in jwks-rsa -> jose@^6, which is
  // pure ESM. Left bundled, the server build emits a require() of that ESM
  // module (ERR_REQUIRE_ESM in production). Marking it external skips
  // bundling and resolves it via Node's own module system at runtime instead.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
