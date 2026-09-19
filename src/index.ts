interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

interface Ai {
  run(
    model: string,
    inputs: Record<string, unknown>
  ): Promise<unknown>;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {

    const url = new URL(request.url);

    // Allow the website itself to load normally
    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    // CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Browser preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Only POST is allowed for AI chat
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
          role: string;
          content?: string;
          text?: string;
        }>;
      };

      const message = String(body.message || "").trim();
      const language = String(body.language || "en");

      if (!message) {
        return new Response(
          JSON.stringify({
            text: "Please enter a message."
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

      const previousMessages = Array.isArray(body.messages)
        ? body.messages
        : [];

      const messages = previousMessages
        .filter((m) => m && (m.content || m.text))
        .slice(-20)
        .map((m) => ({
          role:
            m.role === "assistant"
              ? "assistant"
              : "user",
          content: String(m.content || m.text || "")
        }));

      // Make sure the newest user message is included.
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

Your job is to help users learn, create, solve problems, write,
code, understand information, and plan their goals.

Respond naturally and clearly.

The user's selected language code is: ${language}

When appropriate, answer in the user's selected language.
If the user writes in another language, understand the user and
respond naturally.

Be accurate. If you are uncertain about something, say so clearly.
Do not claim to have performed actions you cannot actually perform.

Keep answers useful and understandable.
`;

      const result = await env.AI.run(
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
      ) as {
        response?: string;
      };

      const answer =
        result?.response ||
        "I received your message, but I couldn't generate a response.";

      return new Response(
        JSON.stringify({
          text: answer,
          language
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
          text: "I'm sorry, but I couldn't connect to the AI right now. Please try again.",
          error: "AI_REQUEST_FAILED"
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
