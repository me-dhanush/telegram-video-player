/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.31.28"],
  turbopack: {
    root: process.cwd(),
  },
};

module.exports = nextConfig;
