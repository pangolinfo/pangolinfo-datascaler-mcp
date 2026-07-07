/**
 * Tool: social_capabilities —— 自省(免费,无后端调用)。
 *
 * AI 第一次接入时建议先调:一次拿到工具全景、默认接入路径(知识空间)、扣费规则、
 * 异步轮询规则、典型工作流。纯本地数据,0 扣费,不打后端。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";
import { SERVER_VERSION } from "../version.js";

const inputSchema = z.object({});

export const socialCapabilities: Tool<typeof inputSchema> = {
  name: "social_capabilities",
  description: t({
    zh: `[自省 · 免费 · 0 调用] 一次性了解本 MCP:能干什么、默认怎么接入、哪些扣费、异步怎么轮询、典型工作流。
AI 首次接入建议先调这个(或 get_context 拿实时账户数据)。纯本地数据,不打后端、不扣费。
Returns: { version, product, onboarding, charging, asyncModel, tools[], workflows[], notes[] }。`,
    en: `[Self-introspection · FREE · 0 backend calls] One call to learn: what this MCP does, the default onboarding path, what's charged, how async polling works, typical workflows.
Recommended first call (or get_context for live account data). Local only — no backend call, no charge.
Returns: { version, product, onboarding, charging, asyncModel, tools[], workflows[], notes[] }.`,
  }),
  inputSchema,
  async execute(_input, ctx) {
    ctx.logger.info("social_capabilities");
    return {
      version: SERVER_VERSION,
      product: t({
        zh: "Pangolin 品牌社媒洞察(白标)。监测品牌/话题在 TikTok/X/YouTube/Instagram/Facebook/Pinterest/Trustpilot 等的声量、情感、竞品、风险,并做 AI 深度分析。",
        en: "Pangolin brand social insight (white-label). Monitor a brand/topic's voice/sentiment/competitors/risk across TikTok/X/YouTube/Instagram/Facebook/Pinterest/Trustpilot, plus AI deep analysis.",
      }),
      onboarding: t({
        zh: "默认走【知识空间】(轻量快道):prepare_space(出计划+费用,免费) → 用户确认行业(必选)+渠道+深度 → create_space(建空间+首采,扣费)。只有要竞品对比/官网/定时监测才用 setup_brand(完整品牌)。",
        en: "Default path = Knowledge Space (lightweight): prepare_space (plan + cost, free) → user confirms industry (required) + platforms + depth → create_space (create + first collection, charged). Use setup_brand (full brand) only for competitors/website/scheduled monitoring.",
      }),
      charging: t({
        zh: "只读全免费。采集类(create_space/refresh_brand/setup_brand)按 estimatedCredits×零售倍率扣积分,采集完成时结算(受理时按预估扣)。analyze_brand 每次 1 credit(成功才扣)。prepare_space/get_brand_summary 免费。积分公式:(1+竞品)×渠道×页数×0.25。",
        en: "All reads free. Collection (create_space/refresh_brand/setup_brand) charges estimatedCredits×retail-rate, settled on completion (charged upfront by estimate). analyze_brand = 1 credit/call (on success). prepare_space/get_brand_summary free. Credits = (1+competitors)×channels×pages×0.25.",
      }),
      asyncModel: t({
        zh: "采集是异步的:create_space/refresh_brand/setup_brand(首采)返回 jobId,用 get_refresh_progress(jobId) 轮询到 completed/partial 再读数据,或 wait_for_refresh 短等。绝不原地干等或重复发起。analyze_brand 是【同步】的,直接返回报告(可能耗时,耐心等)。",
        en: "Collection is async: create_space/refresh_brand/setup_brand return a jobId; poll get_refresh_progress until completed/partial, or wait_for_refresh briefly. Never busy-wait or re-trigger. analyze_brand is SYNC — returns the report directly (may take a while).",
      }),
      tools: [
        { name: "get_context", group: "context", charged: false },
        { name: "suggest_next_actions", group: "context", charged: false },
        { name: "get_usage", group: "context", charged: false },
        { name: "explain_error", group: "context", charged: false },
        { name: "prepare_space", group: "onboarding", charged: false },
        { name: "create_space", group: "onboarding", charged: true, async: true },
        { name: "list_brands", group: "brand", charged: false },
        { name: "get_brand", group: "brand", charged: false },
        { name: "prepare_brand_onboarding", group: "brand", charged: false },
        { name: "setup_brand", group: "brand", charged: true, async: true },
        { name: "update_brand", group: "brand", charged: false },
        { name: "diagnose_brand", group: "collect", charged: false },
        { name: "refresh_brand", group: "collect", charged: true, async: true },
        { name: "get_refresh_progress", group: "collect", charged: false },
        { name: "wait_for_refresh", group: "collect", charged: false },
        { name: "get_brand_metrics", group: "data", charged: false },
        { name: "search_brand_posts", group: "data", charged: false },
        { name: "find_posts_about", group: "data", charged: false },
        { name: "get_brand_sentiment", group: "data", charged: false },
        { name: "get_voice_share", group: "data", charged: false },
        { name: "compare_competitors", group: "data", charged: false },
        { name: "get_risk_alerts", group: "data", charged: false },
        { name: "analyze_brand", group: "analyze", charged: true, async: false },
        { name: "get_brand_summary", group: "analyze", charged: false },
      ],
      workflows: [
        t({
          zh: "看某品牌/话题在讨论什么(默认):prepare_space(出计划+费用) → 确认行业+渠道+深度 → create_space(扣费,返 jobId) → wait_for_refresh/get_refresh_progress(等采集) → get_brand_metrics/analyze_brand。",
          en: "Explore a brand/topic (default): prepare_space → confirm industry+platforms+depth → create_space (charged, jobId) → wait_for_refresh/get_refresh_progress → get_brand_metrics/analyze_brand.",
        }),
        t({
          zh: "刷新已有品牌:diagnose_brand(看要不要采) → refresh_brand(扣费) → get_refresh_progress(等完成) → 读数据。",
          en: "Refresh existing: diagnose_brand → refresh_brand (charged) → get_refresh_progress → read data.",
        }),
        t({
          zh: "深度问答:确认品牌已采集完成 → analyze_brand(1 credit,同步返回报告)。一句话总结用 get_brand_summary(免费)。",
          en: "Deep Q&A: ensure data → analyze_brand (1 credit, sync). Quick summary: get_brand_summary (free).",
        }),
      ],
      notes: [
        t({
          zh: "品牌数据按用户隔离,只看得到自己的。报 data not ready 就先 diagnose_brand / refresh_brand。知识空间不支持 Amazon(要 Amazon 评论用 setup_brand)。采集前用 prepare_space 的 estimatedCredits 给用户报价。",
          en: "Brand data is per-user isolated. On 'data not ready', diagnose_brand / refresh_brand first. Knowledge spaces don't support Amazon (use setup_brand for Amazon reviews). Quote cost from prepare_space's estimatedCredits before collecting.",
        }),
      ],
    };
  },
};
