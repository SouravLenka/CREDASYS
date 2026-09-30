/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com", "avatars.githubusercontent.com"],
  },
  env: {
    NEXT_PUBLIC_BACKEND_URL:
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://credasys-backend-production.up.railway.app",
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive/Windows can lock webpack cache files and break dev runtime.
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
