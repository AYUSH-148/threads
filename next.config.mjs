/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental:{
        serverComponentsExternalPackages:["mongoose"],
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
        ],
      },
      
};

export default nextConfig;
