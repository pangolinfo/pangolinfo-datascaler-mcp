/**
 * Tool: refresh_brand —— 发起一次品牌社媒数据采集(异步,扣费)。
 *
 * 调 POST /api/v1/social/brands/{id}/refresh。异步:只返回 jobId 句柄,绝不阻塞 ——
 * 由 agent 用 get_refresh_progress 轮询。采集耗时(90% 在 3h 内)。
 * 扣费按 estimatedCredits 采集完成时结算(响应里 billing.estimatedCredits 是预估)。
 * 采集深度用 depth(quick/standard/full=页深)或 maxPages(优先)控制。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  brandId: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "品牌 ID(来自 list_brands / setup_brand)。",
        en: "Brand id (from list_brands / setup_brand).",
      }),
    ),
  depth: z
    .enum(["quick", "standard", "full"])
    .optional()
    .describe(
      t({
        zh: "采集深度=页深(quick=3/standard=5/full=10页,默认 full)。深度越大越贵越慢。也可用 maxPages 覆盖。",
        en: "Collection depth = page depth (quick=3 / standard=5 / full=10 pages, default full). Deeper = costlier & slower. Can be overridden by maxPages.",
      }),
    ),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe(
      t({
        zh: "页深 1-10(优先级高于 depth)。",
        en: "Page depth 1-10 (takes precedence over depth).",
      }),
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,避免重复发起采集/重复扣费:默认 24 小时内,同一个键命中会直接返回上次结果、不重跑不重扣;但同一个键若换了不同参数会报冲突错(换参数请换新键)。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to avoid a duplicate collection / double-charge: within ~24h a repeat with the same key replays the previous result (no re-run, no re-charge); reusing the same key with DIFFERENT params returns a conflict error (use a new key for new params).",
      }),
    ),
});

export const refreshBrand: Tool<typeof inputSchema> = {
  name: "refresh_brand",
  description: t({
    zh: `[发起采集 · 扣费 · 异步] 立即为某品牌发起一次社媒数据采集。
⚠️ 异步:本工具只返回作业句柄 jobId,**不会等采集完成**(采集约 90% 在 3 小时内完成)。
拿到 jobId 后,请用 get_refresh_progress(jobId) 轮询进度,**不要原地干等、不要重复发起**。
status 变为 completed/partial 后,再调读类工具(get_brand_metrics/search_brand_posts/...)或 analyze_brand,此时数据才是新的。
扣费:按 estimatedCredits 采集完成时结算(响应里 billing.estimatedCredits 是预估)。
在途去重:若该品牌已有采集在跑,不会重复发起(也不会重复扣费),而是复用/返回那个在途 jobId —— 直接用 get_refresh_progress 轮询它,等完成再按需重试。
深度:depth(quick/standard/full)控制页深并影响费用与耗时,默认 full;maxPages 可精确覆盖(优先级更高:显式 maxPages > depth > 默认 full)。
提示:若只是"数据可能旧了想定期更新",长期定时监测应走 dashboard / 高级接入,而非反复手动 refresh(每次都扣费)。
Returns: { jobId, queuePosition, etaMinutes, billing{estimatedCredits} }。
Use when: 用户要"刷新/更新某品牌的最新社媒数据"。
Don't use: 只想看已有数据(直接用读类工具,免费);查进度(用 get_refresh_progress)。`,
    en: `[Start collection · CHARGED · async] Immediately start a social-media data collection for a brand.
⚠️ Async: returns only a job handle (jobId) and does NOT wait for completion (~90% finish within 3h).
After getting jobId, poll with get_refresh_progress(jobId). Do NOT busy-wait or re-trigger.
Once status is completed/partial, call read tools (get_brand_metrics/search_brand_posts/...) or analyze_brand — data is fresh then.
Charge: settled by estimatedCredits when collection completes (billing.estimatedCredits in the response is an estimate).
In-flight dedup: if a collection is already running for this brand, it will NOT start (or charge for) a second one — it reuses/returns that in-flight jobId. Poll it with get_refresh_progress and retry after it finishes.
Depth: depth (quick/standard/full) controls page depth and affects cost & duration, default full; maxPages overrides it exactly (precedence: explicit maxPages > depth > default full).
Tip: if the user just thinks data may be stale and wants periodic updates, long-term scheduled monitoring should go through the dashboard / advanced onboarding, not repeated manual refreshes (each one is charged).
Returns: { jobId, queuePosition, etaMinutes, billing{estimatedCredits} }.
Use when: user wants to refresh/update a brand's latest social data.
Don't use: to just view existing data (use read tools, free); to check progress (use get_refresh_progress).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    const { brandId, ...body } = input;
    ctx.logger.info(`refresh_brand: brandId=${brandId}`);
    return ctx.client.post(
      `/api/v1/social/brands/${encodeURIComponent(brandId)}/refresh`,
      body,
    );
  },
};
