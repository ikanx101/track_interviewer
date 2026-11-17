/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["exceljs"],
  // Memungkinkan beberapa dev server paralel dengan folder build terpisah.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
