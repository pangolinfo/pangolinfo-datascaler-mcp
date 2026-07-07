/**
 * Tool: get_usage —— 查社媒洞察的用量/扣费(免费,两操作合一)。
 *
 * 默认调 GET /api/v1/social/usage(聚合概览);events:true 时调
 * GET /api/v1/social/usage/events(逐条记录,带 limit/tool/status query 过滤)。
 * 无副作用、不扣费。用于对账、回答"我花了多少积分/最近调了什么"。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { buildQuery } from "./_query.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  events: z
    .boolean()
    .optional()
    .describe(
      t({
        zh: "是否出逐条明细(默认 false=聚合概览;true=逐条记录)。",
        en: "Return per-event detail (default false = aggregate overview; true = per-event records).",
      }),
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      t({
        zh: "逐条模式下返回条数上限(可选,仅 events:true 生效)。",
        en: "Max events (optional, only applies when events:true).",
      }),
    ),
  tool: z
    .string()
    .optional()
    .describe(
      t({
        zh: "按工具名过滤(可选,仅 events:true 生效)。",
        en: "Filter by tool name (optional, only applies when events:true).",
      }),
    ),
  status: z
    .string()
    .optional()
    .describe(
      t({
        zh: "按状态过滤(可选,仅 events:true 生效)。",
        en: "Filter by status (optional, only applies when events:true).",
      }),
    ),
});

export const getUsage: Tool<typeof inputSchema> = {
  name: "get_usage",
  description: t({
    zh: `[用量/扣费明细 · 免费] 查社媒洞察的积分消耗。
默认聚合概览;events:true 出逐条记录(每条含 creditsCharged/tool/status/时间)。不扣费。
Returns: 概览 data{window,totals,byTool[],quota,credits};逐条 data{events[]{tool,brandId,status,creditsCharged,latencyMs,createdAt,toolLabel},nextCursor}。
Use when: 用户问"我花了多少积分/最近调了什么"、对账。`,
    en: `[Usage / billing detail · FREE] Check credit consumption for social insights.
Default: aggregate overview; events:true: per-event records (each with creditsCharged/tool/status/time). No charge.
Returns: overview data{window,totals,byTool[],quota,credits}; events data{events[]{tool,brandId,status,creditsCharged,latencyMs,createdAt,toolLabel},nextCursor}.
Use when: user asks "how many credits did I spend / what did I call recently", reconciliation.`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_usage: events=${input.events ?? false}`);
    if (input.events) {
      const qs = buildQuery({ limit: input.limit, tool: input.tool, status: input.status });
      return ctx.client.get(`/api/v1/social/usage/events${qs}`);
    }
    return ctx.client.get("/api/v1/social/usage");
  },
};
