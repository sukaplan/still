import { astronomyResponse } from './astronomy.mjs';
import { apiResponse } from './daily.mjs';
import { imageSearchResponse } from './images.mjs';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/** Route public content APIs and serve the assets embedded by the build. */
export function createWorker(resources, images) {
  return {
    async fetch(request, environment, context) {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response('Method not allowed', { status: 405 });
      }

      const { pathname } = new URL(request.url);
      if (pathname === '/api/astronomy') return astronomyResponse(request);
      if (pathname === '/api/images') return imageSearchResponse(request);
      if (pathname.startsWith('/api/')) return apiResponse(request, context);

      const resource = resources[pathname];
      if (resource) {
        return new Response(request.method === 'HEAD' ? null : resource.body, {
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': resource.type,
            'Cache-Control': pathname === '/' ? 'no-cache' : 'public, max-age=3600',
          },
        });
      }

      const image = images[pathname];
      if (image) {
        const bytes = Uint8Array.from(atob(image.data), (character) => character.charCodeAt(0));
        return new Response(request.method === 'HEAD' ? null : bytes, {
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': image.type,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      return new Response('A quiet corner, but no page here.', {
        status: 404,
        headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' },
      });
    },
  };
}
