/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Both use Node built-ins the bundler cannot polyfill, and both are only
    // ever imported on the server.
    serverComponentsExternalPackages: ["mongoose", "redis"],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "utfs.io", // Add the utfs.io hostname here
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

};

export default nextConfig;
