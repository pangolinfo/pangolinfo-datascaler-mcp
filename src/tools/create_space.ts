/**
 * Tool: create_space —— 建知识空间 + 首采(扣费,默认接入第二步)。
 *
 * 调 POST /api/v1/social/spaces。建空间只占 1 个品牌位、本身不扣积分;
 * 采集完成时按 estimatedCredits 扣。空间底层就是品牌,返回 spaceId(=brandId),
 * 后续所有 /brands/{spaceId}/* (数据/分析/进度) 都用它。
 *
 * ⚠️ industries 必填(≥1,来自 prepare_space 的 industryCandidates + 用户确认);缺失后端返 400。
 * ⚠️ 不支持 amazon(传 amazon_reviews 后端返 400,引导用 setup_brand)。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(t({ zh: "空间/品牌名,如 'Anker'。", en: "Space/brand name, e.g. 'Anker'." })),
  industries: z
    .array(z.string())
    .min(1)
    .describe(
      t({
        zh: "行业(必填,≥1),取自 prepare_space 的 industryCandidates + 用户确认。写入空间描述、决定采集方向。缺失后端报 400。",
        en: "Industries (required, ≥1), from prepare_space's industryCandidates + user confirmation. Drives collection direction. 400 if missing.",
      }),
    ),
  offerings: z
    .array(z.string())
    .optional()
    .describe(t({ zh: "产品/服务(可选,来自 prepare)。", en: "Products/services (optional, from prepare)." })),
  platforms: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "用户确认的渠道(可选,默认 7 社媒;reddit/threads 同价)。⚠️不支持 amazon,传 amazon_reviews 报 400(需 Amazon 评论用 setup_brand)。",
        en: "Confirmed platforms (optional, default 7 social; reddit/threads same price). ⚠️No amazon — amazon_reviews returns 400 (use setup_brand for Amazon reviews).",
      }),
    ),
  depth: z
    .enum(["quick", "standard", "full"])
    .optional()
    .describe(
      t({
        zh: "采集深度=页深,默认 full。quick=3页 / standard=5页 / full=10页。深度越大越贵越慢(见 prepare_space 的 estimatedCredits)。",
        en: "Depth = page depth, default full. quick=3 / standard=5 / full=10 pages. Deeper = pricier & slower (see prepare_space estimatedCredits).",
      }),
    ),
  keywords: z
    .array(z.string())
    .optional()
    .describe(t({ zh: "覆盖关键词(可选,留空自动生成)。", en: "Override keywords (optional, auto-generated if omitted)." })),
  description: z
    .string()
    .optional()
    .describe(t({ zh: "覆盖描述(可选,留空由行业生成)。", en: "Override description (optional)." })),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,避免重复建空间/重复扣费。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to avoid duplicate space / double-charge.",
      }),
    ),
});

export const createSpace: Tool<typeof inputSchema> = {
  name: "create_space",
  description: t({
    zh: `[建空间+首采 · 扣费 · 默认接入第二步] 创建一个知识空间并立即开始首轮社媒采集。
建空间只占 1 个品牌位、本身不扣积分;**采集完成时**按 estimatedCredits 扣积分(受理时按预估扣)。
⚠️ 前置:必须先 prepare_space 拿到 industryCandidates,让用户选定 **industries(必填)** 再调本工具;缺 industries 后端报 400。
⚠️ 不支持 amazon(传 amazon_reviews 报 400,引导用 setup_brand)。
异步:立即返回 spaceId + 采集 jobId,**不等采集完成**。用 get_refresh_progress(jobId) 轮询,或 wait_for_refresh 短等。完成后再调读类工具/analyze_brand。
空间底层就是品牌:返回的 spaceId = brandId,后续所有按 brandId 的工具都用它。
Returns: data{ spaceId(=brandId), keywords[], platforms[], depth, maxPages, collection{jobId,total}, billing{estimatedCredits,chargedOn:'collection-completion'} }。
Use when: prepare_space 之后、用户已确认行业+渠道+深度。
Don't use: 要竞品对比/官网/定时(用 setup_brand);要 Amazon 评论(用 setup_brand)。`,
    en: `[Create space + first collection · CHARGED · default onboarding step 2] Create a knowledge space and start first-round collection.
Creating a space only takes 1 brand slot (no credit charge itself); credits are charged **on collection completion** by estimatedCredits (charged upfront by estimate).
⚠️ Precondition: call prepare_space first to get industryCandidates, have the user pick **industries (required)**, then call this. 400 if industries missing.
⚠️ No amazon (amazon_reviews returns 400 — use setup_brand).
Async: returns spaceId + collection jobId immediately, does NOT wait. Poll get_refresh_progress(jobId) or wait_for_refresh. Then call read tools / analyze_brand.
A space IS a brand: returned spaceId = brandId; use it for all brandId-based tools.
Returns: data{ spaceId(=brandId), keywords[], platforms[], depth, maxPages, collection{jobId,total}, billing{estimatedCredits,chargedOn:'collection-completion'} }.
Use when: after prepare_space, once the user confirmed industry + platforms + depth.
Don't use: for competitors/website/schedule (use setup_brand); for Amazon reviews (use setup_brand).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`create_space: name="${input.name}" depth=${input.depth ?? "full"}`);
    return ctx.client.post("/api/v1/social/spaces", input);
  },
};
