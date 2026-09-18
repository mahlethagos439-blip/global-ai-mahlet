export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL =
  "@cf/meta/llama-3.2-11b-vision-instruct";

const SYSTEM_PROMPT = `
You are Global AI Mahlet, a helpful multilingual AI assistant and study tutor.

Help users with:
- Mathematics
- Physics
- Chemistry
- Biology
- Computer Science
- Programming
- Writing
- Study plans
- General questions

Explain difficult concepts clearly and step by step.
Be accurate, respectful, helpful, and suitable for the user's level.
Respond in the language requested by the user.
Do not invent information.
`;

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response(
          "Method Not Allowed",
          { status: 405 }
        );
      }

      return chat(request, env);
    }

    if (url.pathname === "/api/vision") {
      if (request.method !== "POST") {
        return new Response(
          "Method Not Allowed",
          { status: 405 }
        );
      }

      return vision(request, env);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;

async function chat(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as {
      messages?: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
    };

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    if (!messages.length) {
      return Response.json(
        { error: "No messages were provided." },
        { status: 400 }
      );
    }

    if (!messages.some(m => m.role === "system")) {
      messages.unshift({
        role: "system",
        content: SYSTEM_PROMPT
      });
    }

    const result = await env.AI.run(
      TEXT_MODEL,
      {
        messages,
        stream: true,
        max_tokens: 1024
      }
    );

    return new Response(result, {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error(
      "Global AI Mahlet chat error:",
      error
    );

    return Response.json(
      {
        error:
          "Failed to process the AI request."
      },
      { status: 500 }
    );
  }
}

async function vision(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as {
      image?: string;
      prompt?: string;
    };

    if (!body.image) {
      return Response.json(
        { error: "No image was provided." },
        { status: 400 }
      );
    }

    const prompt =
      body.prompt ||
      "Analyze this image carefully. If it contains a school question, solve it step by step. Read visible text accurately.";

    const result = await env.AI.run(
      VISION_MODEL,
      {
        prompt,
        image: body.image,
        max_tokens: 1024
      }
    );

    return Response.json(result);

  } catch (error) {
    console.error(
      "Global AI Mahlet vision error:",
      error
    );

    return Response.json(
      {
        error:
          "I couldn't understand that image."
      },
      { status: 500 }
    );
  }
         }
