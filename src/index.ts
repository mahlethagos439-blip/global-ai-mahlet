export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    if (path === "/") {
      path = "/index.html";
    }

    // Try serving static assets or fallback to index.html
    try {
      // If using Cloudflare Pages / Workers static asset binding:
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
    } catch (e) {
      // Fallback response if asset binding isn't active in local dev
    }

    // Fallback inline handler if asset routing isn't bound directly
    return new Response("Please ensure your Cloudflare static assets are configured correctly or place index.html in public/", {
      status: 200,
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  },
};
