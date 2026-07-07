/**
 * Tool: get_context —— 一次加载账户/套餐/配额/品牌/渠道(免费,建议接入先调)。
 *
 * 调 GET /api/v1/social/context。无副作用、不扣费。
 * 一把梭把 AI 接入所需的上下文(身份/套餐/配额/剩余积分/品牌列表/支持渠道)拿全,
 * 免得逐个工具试探。建议 AI 首次接入时先调这个。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({});

export const getContext: Tool<typeof inputSchema> = {
  name: "get_context",
  description: t({
    zh: `[上下文 · 免费 · 建议接入先调] 一次加载账户/套餐/配额/品牌列表/支持渠道。
无参数、无副作用、不扣费。AI 首次接入或需要全局状态时先调这个,免得逐个工具试探。
Returns: data{ identity, plan, quota{aiQuestions,refreshes,exports,brands}, credits{remaining}, brands[], supportedPlatforms[]{id,name,type,defaultSelected,creditCost,requiresAsin} }。
Use when: AI 首次接入、或需要知道用户有哪些品牌/额度/支持哪些渠道。`,
    en: `[Context · FREE · recommended first call] Load account/plan/quota/brand list/supported platforms in one shot.
No params, no side effects, no charge. Call this on first onboarding or whenever you need global state, instead of probing tool by tool.
Returns: data{ identity, plan, quota{aiQuestions,refreshes,exports,brands}, credits{remaining}, brands[], supportedPlatforms[]{id,name,type,defaultSelected,creditCost,requiresAsin} }.
Use when: AI onboarding, or you need to know the user's brands / quota / supported platforms.`,
  }),
  inputSchema,
  async execute(_input, ctx) {
    ctx.logger.info("get_context");
    return ctx.client.get("/api/v1/social/context");
  },
};
