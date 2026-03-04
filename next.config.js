/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
}

module.exports = nextConfig



import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
