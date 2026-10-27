import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Only the local server reads this secret; Vite never exposes it as client configuration.
function roadNoticesDev(key: string | undefined): Plugin {
  return {
    name: 'road-notices-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        if (path !== '/road-disruptions-api' && !path.startsWith('/road-disruptions-api/')) return next();
        try {
          const module = await server.ssrLoadModule('/worker/roadDisruptions.ts');
          const result = await module.fetchRoadDisruptions(new Request(new URL(request.url ?? path, 'http://localhost'), { method: request.method }), { TRANSPORT_VIC_API_KEY: key });
          response.statusCode = result.status;
          result.headers.forEach((value: string, name: string) => response.setHeader(name, value));
          response.end(await result.text());
        } catch {
          response.statusCode = 503;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: 'Road feed unavailable' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), roadNoticesDev(process.env.TRANSPORT_VIC_API_KEY ?? loadEnv(mode, process.cwd(), 'TRANSPORT_').TRANSPORT_VIC_API_KEY)],
  server: { proxy: { '/future-api': { target: 'http://127.0.0.1:8001', rewrite: path => path.replace(/^\/future-api/, '') } } },

  resolve: {
    /*
     * ── ONE THREE.JS, NOT TWO ────────────────────────────────────────────
     *
     * The console said so on every load:
     *
     *   WARNING: Multiple instances of Three.js being imported.
     *
     * `stats-gl`, which arrives as a dependency of drei, asks for three
     * 0.170 while this project is on 0.185, so npm installed a second copy
     * under it. Importing drei by its barrel pulls that in even though
     * nothing here uses the stats overlay.
     *
     * WHY IT IS NOT A HARMLESS WARNING
     *   Two copies means two sets of classes. Anything that tests identity
     *   across them — `instanceof`, the layer masks the raycaster compares,
     *   the material caches the renderer keys on — can quietly disagree, and
     *   the symptom is never an error. It is an object that does not draw,
     *   or a click that hits nothing, with a clean console underneath it.
     *
     *   That is precisely the class of fault being chased when this was
     *   found, which is reason enough to remove it before looking further:
     *   a duplicate renderer is not something to leave in place while
     *   debugging what the renderer is doing.
     *
     * Deduping resolves every request for `three` to the one at the root.
     */
    dedupe: ['three'],
  },
}))
