const nextConfig = {
  async headers() {
    const webOrigin = new URL(process.env.CORS_ORIGIN ?? "http://localhost:3000").origin;
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${webOrigin}` },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" }
    ] }];
  },
  serverExternalPackages: ["re2-wasm", "playwright", "playwright-core", "katex"],
  transpilePackages: [
    "@cognelo/config",
    "@cognelo/contracts",
    "@cognelo/core",
    "@cognelo/db",
    "@cognelo/activity-sdk",
    "@cognelo/plugin-registry"
  ]
};

export default nextConfig;
