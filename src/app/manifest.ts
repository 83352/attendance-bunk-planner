import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'dontbunk',
    short_name: 'dontbunk',
    description: 'Check your safe bunk count in seconds.',
    start_url: '/',
    display: 'standalone',
    // The splash screen sits behind the page, so it matches the cream paper
    // background; theme_color tints the browser chrome, which sits against the
    // black site header.
    background_color: '#f5f2e9',
    theme_color: '#111111',
    icons: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // A separate file, not the 'any' icon reused: Android crops a maskable
        // icon to a circle, so this one keeps the mark inside the middle 80%
        // and bleeds its background to the edge.
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
