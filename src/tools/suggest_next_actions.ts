/**
 * Tool: suggest_next_actions —— 根据当前状态推荐下一步(免费,引导用)。
 *
 * 调 GET /api/v1/social/actions。无副作用、不扣费。
 * 后端结合账户/品牌/配额状态,返回一组建议调用的工具及其入参,给 AI 一个引导。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({});

export const suggestNextActions: Tool<typeof inputSchema> = {
  name: "suggest_next_actions",
  description: t({
    zh: `[推荐下一步 · 免费] 根据当前账户/品牌状态推荐接下来可调用的操作。
无参数、无副作用、不扣费。返回一组建议工具及其入参,给 AI/用户一个引导。
Returns: data{ tier, quota, credits, brandCount, nextActions[]{tool,label,reason,args} }。
Use when: 不确定下一步该做什么、想给用户一个引导。`,
    en: `[Suggest next actions · FREE] Recommend the next operations to call based on current account/brand state.
No params, no side effects, no charge. Returns a set of suggested tools + args to guide the AI/user.
Returns: data{ tier, quota, credits, brandCount, nextActions[]{tool,label,reason,args} }.
Use when: unsure what to do next, or you want to guide the user.`,
  }),
  inputSchema,
  async execute(_input, ctx) {
    ctx.logger.info("suggest_next_actions");
    return ctx.client.get("/api/v1/social/actions");
  },
};
