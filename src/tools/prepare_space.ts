/**
 * Tool: prepare_space —— 出知识空间采集计划(免费,默认接入第一步)。
 *
 * 调 POST /api/v1/social/spaces/prepare。无副作用、不扣费。
 * 返回行业候选 + 建议关键词 + 默认渠道 + 三档深度及每档积分估算。
 * 这是"看看某品牌/话题最近在被讨论什么"的默认入口 —— 出计划 → 用户确认行业+渠道+深度 → create_space。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "品牌名或话题,如 'Anker' / '无线耳机降噪'。",
        en: "Brand name or topic, e.g. 'Anker' / 'noise-cancelling earbuds'.",
      }),
    ),
  extraKeywords: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "追加关键词(可选,≤50)。传空数组 [] 无意义,省略即可。",
        en: "Extra keywords (optional, ≤50). Omit if none.",
      }),
    ),
  platforms: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "预选渠道覆盖(可选)。不传则默认给 7 个社媒。",
        en: "Preselected platforms (optional). Defaults to 7 social platforms if omitted.",
      }),
    ),
});

export const prepareSpace: Tool<typeof inputSchema> = {
  name: "prepare_space",
  description: t({
    zh: `[出采集计划 · 免费 · 默认接入第一步] 由品牌名/话题生成一份采集计划,不扣费、无副作用。
这是"看看某品牌/话题最近在被讨论什么"的**默认入口**:先出计划,把行业候选和三档费用给用户看,确认后再 create_space 建空间。
Returns: data{ resolvedName, description, industryCandidates[], offeringCandidates[], suggestedKeywords[], brandKeywords[], defaultPlatforms[](7个社媒), optionalPlatforms[](threads/reddit,同价), depthOptions[]{tier,maxPages,eta,approxPostsPerPlatform,estimatedCredits}, nextStep }。
关键:depthOptions 三档 = quick(3页,~20-30min) / standard(5页,~30-60min) / full(10页,~1-1.5h,默认),每档带 estimatedCredits(采集要花的积分预估)。把它翻译成价格给用户确认。approxPostsPerPlatform(≈关键词数×页数×35%)只是粗估、非保证,实际以采集结果为准。
关键词必须英文:知识空间的社媒发现关键词请用英文(数据源主要索引英文内容,含中日韩字符的词会被上游丢弃)。中文品牌/话题也应译成英文关键词(如"无线耳机降噪"→"noise cancelling earbuds")。
命名:品牌名有官方英文写法时优先用官方英文名(resolvedName 已按此规整)。
下一步:用户选定**行业(必选,取自 industryCandidates)** + 渠道 + 深度后,调 create_space。建空间前务必让用户确认行业/渠道/深度/预估积分与耗时(一次轻确认)。
Use when: 用户想了解某品牌/话题的社媒讨论、口碑、声量 —— 这类需求默认从这里开始。
Don't use: 用户明确要长期精细监测(竞品对比/官网/定时) → 用 setup_brand(完整品牌);品牌/空间已存在 → 用 list_brands 找(同行业/同目标应复用,勿重复新建)。`,
    en: `[Collection plan · FREE · default onboarding step 1] Generate a collection plan from a brand/topic. No side effects, no charge.
This is the **default entry** for "what's being said about brand/topic X lately": get the plan, show the user the industry candidates + 3-tier cost, then create_space after confirmation.
Returns: data{ resolvedName, description, industryCandidates[], offeringCandidates[], suggestedKeywords[], brandKeywords[], defaultPlatforms[](7 social), optionalPlatforms[](threads/reddit, same price), depthOptions[]{tier,maxPages,eta,approxPostsPerPlatform,estimatedCredits}, nextStep }.
depthOptions: quick(3 pages,~20-30min) / standard(5 pages,~30-60min) / full(10 pages,~1-1.5h, default), each with estimatedCredits. Translate to a price and confirm with the user. approxPostsPerPlatform (≈ keywords × pages × 35%) is a rough estimate, not a guarantee.
Keywords MUST be English: Knowledge-Space social-discovery keywords must be English (the source indexes mostly English; keywords containing CJK characters are dropped upstream). Translate non-English brands/topics into English keywords (e.g. "无线耳机降噪" → "noise cancelling earbuds").
Naming: prefer the official English brand name when one exists (resolvedName is already normalized this way).
Next: after the user picks an **industry (required, from industryCandidates)** + platforms + depth, call create_space. Always confirm industry/platforms/depth/estimated credits & ETA with the user first (one light confirmation).
Use when: user wants to understand a brand/topic's social discussion, reputation, or share of voice — default to starting here.
Don't use: user explicitly wants long-term fine-grained monitoring (competitors/website/schedule) → use setup_brand; brand/space already exists → use list_brands (reuse same-industry/same-target spaces; don't create duplicates).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`prepare_space: query="${input.query}"`);
    return ctx.client.post("/api/v1/social/spaces/prepare", input);
  },
};
