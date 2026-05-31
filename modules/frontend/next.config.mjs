/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const userApi = process.env.USER_MODULE_URL || "http://localhost:8001";
    const graphApi = process.env.GRAPH_MODULE_URL || "http://localhost:8002";
    const chatApi = process.env.CHAT_MODULE_URL || "http://localhost:8003";

    return [
      { source: "/api/auth/:path*", destination: `${userApi}/api/auth/:path*` },
      { source: "/api/documents/:path*", destination: `${graphApi}/api/documents/:path*` },
      { source: "/api/query/:path*", destination: `${graphApi}/api/query/:path*` },
      { source: "/api/chat/:path*", destination: `${chatApi}/api/chat/:path*` },
    ];
  },
};

export default nextConfig;
