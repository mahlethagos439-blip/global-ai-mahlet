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

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

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

      const systemPrompt = `
You are Global AI Mahlet, a helpful,
friendly and honest multilingual AI assistant.

The user's selected language is:
${language}

Help users learn, solve problems, write,
code, understand information and analyze images.

IMPORTANT IMAGE RULES:

When the user sends an image, actually analyze it.

Describe only things that can reasonably be
seen in the image.

If the user asks about text in the image,
read the visible text carefully.

If the image is unclear, say so.

Never pretend to see something that is not visible.

Answer naturally in the user's selected language
when appropriate.

You are an AI assistant. Be honest about that.
`;

      let result: any;

      /*
       * ================================
       * IMAGE + TEXT REQUEST
       * ================================
       */

      if (image) {

        const imageUrl =
          image.startsWith("data:")
            ? image
            : `data:image/jpeg;base64,${image}`;

        const userContent: any[] = [
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          },
          {
            type: "text",
            text:
              message ||
              "Please analyze this image and explain what you see."
          }
        ];

        result =
          await env.AI.run(
            "@cf/google/gemma-4-26b-a4b-it",
            {
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                {
                  role: "user",
                  content: userContent
                }
              ],

              max_tokens: 1024,

              temperature: 0.6,

              chat_template_kwargs: {
                enable_thinking: false
              }
            }
          );

      } else {

        /*
         * ================================
         * NORMAL TEXT REQUEST
         * ================================
         */

        if (
          !messages.length ||
          messages[messages.length - 1].content !== message
        ) {
          messages.push({
            role: "user",
            content: message
          });
        }

        result =
          await env.AI.run(
            "@cf/google/gemma-4-26b-a4b-it",
            {
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                ...messages
              ],

              max_tokens: 1024,

              temperature: 0.6,

              chat_template_kwargs: {
                enable_thinking: false
              }
            }
          );
      }

      const answer =
        result?.response ||
        result?.result?.response ||
        result?.choices?.[0]?.message?.content;

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
            "I couldn't complete that request right now.",

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
