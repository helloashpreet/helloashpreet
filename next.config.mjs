/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/notes',
        permanent: false,
      },
      {
        source: '/:path((?!notes|api|_next|static|public|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)',
        destination: '/notes/:path',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
