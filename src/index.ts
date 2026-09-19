interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

interface Ai {
  run(
    model: string,
    inputs: Record<string, unknown>
  ): Promise<any>;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {

    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Let Cloudflare serve the website
    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    // Only POST is allowed for chat
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    try {

      const body = await request.json() as {
        message?: string;
        language?: string;
        messages?: Array<{
          role?: string;
          content?: string;
          text?: string;
        }>;
      };

      const message =
        String(body.message || "").trim();

      const language =
        String(body.language || "en");

      if (!message) {
        return new Response(
          JSON.stringify({
            error: "Message is empty"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      const previousMessages =
        Array.isArray(body.messages)
          ? body.messages
          : [];

      const messages =
        previousMessages
          .filter(
            m =>
              m &&
              (m.content || m.text)
          )
          .slice(-20)
          .map(m => ({
            role:
              m.role === "assistant"
                ? "assistant"
                : "user",
            content:
              String(
                m.content ||
                m.text ||
                ""
              )
          }));

      // Make sure the current user message exists
      if (
        !messages.length ||
        messages[messages.length - 1].content !== message
      ) {
        messages.push({
          role: "user",
          content: message
        });
      }

      const systemPrompt = `
You are Global AI Mahlet, a helpful multilingual AI assistant.

Help users learn, create, solve problems, write, code,
understand information, and plan their goals.

The user's selected language is:
${language}

Understand the user's message and respond naturally.

When appropriate, answer in the selected language.

Be accurate and useful.

If you are uncertain, say so clearly.

Do not claim to have performed actions that you cannot actually perform.
`;

      // Cloudflare Workers AI
      const result =
        await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              ...messages
            ],
            max_tokens: 1024,
            temperature: 0.6
          }
        );

      const answer =
        result?.response ||
        result?.result?.response;

      if (!answer) {
        throw new Error(
          "Cloudflare AI returned no response"
        );
      }

      return new Response(
        JSON.stringify({
          text: String(answer),
          language: language
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {

      console.error(
        "Global AI Mahlet Worker error:",
        error
      );

      return new Response(
        JSON.stringify({
          text:
            "Global AI Mahlet could not connect to the AI model right now.",
          error:
            error instanceof Error
              ? error.message
              : String(error)
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }
  }
};
