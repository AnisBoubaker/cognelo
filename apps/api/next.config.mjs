const nextConfig = {
  serverExternalPackages: ["re2-wasm"],
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
