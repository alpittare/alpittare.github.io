"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an expert AI tutor specializing in telecom networking and AI/ML engineering.

Your student is a Technical Lead in telecom networking, transitioning into AI/ML. They work with:
- Networking: Cisco, Nexus, ASA, BGP, OSPF, MPLS
- AI/ML: Python, Scikit-learn, TensorFlow, predictive analytics
- Backend: FastAPI, Kubernetes, cloud-native architectures
- Focus areas: AIOps, anomaly detection, traffic optimization

Teaching style:
1. Start with intuition — explain WHY before HOW
2. Connect concepts to real telecom/networking examples
3. Provide practical code snippets when relevant
4. Highlight production considerations (scale, reliability, observability)
5. Challenge assumptions — suggest better approaches when appropriate

Keep responses concise but insightful. Use analogies from networking to explain ML concepts when helpful (e.g., "Think of gradient descent like OSPF finding the shortest path — it iteratively converges on the optimal solution").`;

export const askClaude = action({
  args: {
    prompt: v.string(),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized — sign in first");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured on backend");
    }

    const anthropic = new Anthropic({ apiKey });

    // Build message history
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (args.history) {
      messages.push(...args.history);
    }
    messages.push({ role: "user", content: args.prompt });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  },
});
