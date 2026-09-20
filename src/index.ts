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

interface ChatMessage {
  role?: string;
  content?: string;
  text?: string;
}

interface RequestBody {
  message?: string;
  language?: string;
  image?: string;
  messages?: ChatMessage[];
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

    // CORS preflight
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

    // Only POST is allowed
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

      const body =
        await request.json() as RequestBody;

      const message =
        String(body.message || "").trim();

      const language =
        String(body.language || "en");

      const image =
        typeof body.image === "string"
          ? body.image
          : "";

      /*
       * An image is optional.
       * Text-only conversations continue using
       * the existing Llama 3.1 model.
       */

      if (!message && !image) {
        return new Response(
          JSON.stringify({
            error: "Message or image is required"
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

      // Add the current user message when present
      if (message) {

        if (
          !messages.length ||
          messages[messages.length - 1].content !== message
        ) {
          messages.push({
            role: "user",
            content: message
          });
        }

      } else if (image) {

        // If the user sent an image without text,
        // give the vision model a useful instruction.
        messages.push({
          role: "user",
          content:
            "Please analyze this image and explain what you see."
        });
      }

      const systemPrompt = `
You are Global AI Mahlet, a warm, helpful,
multilingual AI assistant.

Help users learn, create, solve problems,
write, code, understand information,
analyze images, and plan their goals.

The user's selected language is:
${language}

Respond naturally in the selected language
when appropriate.

IMPORTANT IMAGE BEHAVIOR:

When an image is provided, actually analyze
the image before answering.

Describe relevant visual information accurately.

If the user asks a question about something
in the image, answer using what you can actually
observe.

If the image is unclear, say what you can and
cannot determine.

Never pretend that you can see something that
is not visible.

If the user asks you to read text from an image,
extract the text that is actually visible.

If the user provides a photograph of a problem,
diagram, document, object, or scene, help them
understand it based on the image.

Be accurate and useful.

If you are uncertain, say so clearly.

Do not claim to have performed actions that
you cannot actually perform.

Be warm and conversational while remaining
honest that you are an AI.
`;

      let result: any;

      /*
       * IMAGE REQUEST
       *
       * Cloudflare's Llama 3.2 11B Vision model
       * accepts the image as a base64/data URL.
       */
      if (image) {

        result =
          await env.AI.run(
            "@cf/meta/llama-3.2-11b-vision-instruct",
            {
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                ...messages
              ],

              image: image,

              max_tokens: 1024,

              temperature: 0.6
            }
          );

      } else {

        /*
         * NORMAL TEXT REQUEST
         *
         * Keep the existing working model.
         */
        result =
          await env.AI.run(
            "@cf/meta/llama-3.1-8b-instruct-fast",
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
      }

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
          language: language,
          imageAnalyzed: Boolean(image)
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
            "Global AI Mahlet could not analyze the image or connect to the AI model right now.",

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
