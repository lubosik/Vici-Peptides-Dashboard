/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid SIGBUS in build worker on some systems (dev server stays up)
  experimental: {
    webpackBuildWorker: false,
  },
  // Optimize images
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
  // Output mode: 'standalone' for Vercel, remove for Hostinger
  // Hostinger works better without standalone output
  // output: 'standalone', // Commented out for Hostinger compatibility
}

module.exports = nextConfig
