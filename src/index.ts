export interface Env {
  AI: Ai;
}

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (request.method !== "POST") {
      return json({ error: "Use POST." }, 405);
    }

    try {
      const body = await request.json();

      if (url.pathname === "/api/chat") {
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const language = body.language || "English";

        const system = {
          role: "system",
          content:
            `You are Global AI Mahlet, a friendly, intelligent and helpful AI assistant. ` +
            `Explain things clearly and step by step when useful. ` +
            `Help with learning, mathematics, physics, chemistry, biology, computer science, ` +
            `programming, writing, creativity and everyday questions. ` +
            `Answer in ${language} when possible. Be accurate and honest.`
        };

        const response = await env.AI.run(TEXT_MODEL, {
          messages: [system, ...messages],
          max_tokens: 1024
        });

        return json(response);
      }

      if (url.pathname === "/api/vision") {
        const image = body.image;
        const prompt =
          body.prompt || "Describe and understand this image.";
        const language = body.language || "English";

        if (!image) {
          return json({ error: "No image was provided." }, 400);
        }

        const response = await env.AI.run(VISION_MODEL, {
          messages: [
            {
              role: "system",
              content:
                `You are Global AI Mahlet, a helpful image-understanding AI. ` +
                `Analyze images carefully and answer accurately. ` +
                `Answer in ${language} when possible.`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          image
        });

        return json(response);
      }

      return json({ error: "Endpoint not found." }, 404);

    } catch (error) {
      return json({
        error: error instanceof Error
          ? error.message
          : "AI server error."
      }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
