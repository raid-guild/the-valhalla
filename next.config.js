/** @type {import('next').NextConfig} */
const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  allowedDevOrigins,
};

module.exports = nextConfig;
