import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `
You are Global AI Mahlet, a helpful multilingual AI assistant and study tutor.

Your main purposes are:
- Help students learn Mathematics, Physics, Chemistry, and Biology.
- Explain difficult concepts step by step.
- Give practice questions and quizzes.
- Help with Computer Science and beginner programming.
- Help users understand mistakes instead of simply giving answers.
- Help with summaries, study plans, writing, brainstorming, and general questions.
- Be clear, respectful, encouraging, and accurate.
- Adapt explanations to the user's level.
- When solving a problem, show the important reasoning and steps.
- Do not claim that you can see a photo or file unless the content was actually provided to you.
- Respond in the language requested by the user.
`;

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Serve the website
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// AI chat API
		if (url.pathname === "/api/chat") {
			if (request.method !== "POST") {
				return new Response("Method not allowed", {
					status: 405,
				});
			}

			return handleChatRequest(request, env);
		}

		return new Response("Not found", {
			status: 404,
		});
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json()) as {
			messages?: ChatMessage[];
		};

		const messages: ChatMessage[] = Array.isArray(body.messages)
			? body.messages
			: [];

		if (!messages.some((message) => message.role === "system")) {
			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(
			MODEL_ID,
			inputs,
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Global AI Mahlet error:", error);

		return new Response(
			JSON.stringify({
				error: "Failed to process the AI request.",
			}),
			{
				status: 500,
				headers: {
					"content-type": "application/json",
				},
			},
		);
	}
}
