/**
 * Tool: diagnose_brand —— 品牌/空间数据就绪检查(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/diagnose。无副作用、不扣费。
 * 检查数据是否就绪/是否过期/要不要补采,并给出建议下一步。
 * 读数据或 analyze 前先调它确认数据够不够新;报 data not ready 时先诊断。
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
        zh: "品牌/空间 ID(来自 list_brands / create_space / setup_brand)。",
        en: "Brand/space id (from list_brands / create_space / setup_brand).",
      }),
    ),
});

export const diagnoseBrand: Tool<typeof inputSchema> = {
  name: "diagnose_brand",
  description: t({
    zh: `[数据就绪检查 · 免费] 检查某品牌/空间的数据是否就绪、是否过期、要不要补采。
无副作用、不扣费。返回数据就绪状态、新鲜度判定、建议补采的渠道及下一步。
Returns: data{ dataReady, freshnessVerdict, ageDays, totalPosts, configuredPlatforms[], recommendedPlatformsToRefresh[], quotaOkForRefresh, lastRefreshJobId, nextActions[] }。
Use when: analyze/读数据前想确认数据够不够新;报 data not ready 时先诊断。`,
    en: `[Data readiness check · FREE] Check whether a brand/space's data is ready, stale, or needs re-collection.
No side effects, no charge. Returns readiness, freshness verdict, platforms to refresh, and next actions.
Returns: data{ dataReady, freshnessVerdict, ageDays, totalPosts, configuredPlatforms[], recommendedPlatformsToRefresh[], quotaOkForRefresh, lastRefreshJobId, nextActions[] }.
Use when: confirming data is fresh enough before analyze/read; diagnose first when you hit 'data not ready'.`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`diagnose_brand: brandId=${input.brandId}`);
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/diagnose`,
    );
  },
};
