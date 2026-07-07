/**
 * Tool: explain_error —— 解释错误码 + 建议下一步(免费)。
 *
 * 调 GET /api/v1/social/errors/explain?code=。无副作用、不扣费。
 * 把一个不懂的错误码翻译成人话:含义、是否可重试、建议动作、计费影响、相关链接。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { buildQuery } from "./_query.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "错误码,如收到的响应里的 code 字段。",
        en: "Error code, e.g. the `code` field from a response you received.",
      }),
    ),
});

export const explainError: Tool<typeof inputSchema> = {
  name: "explain_error",
  description: t({
    zh: `[错误解释 · 免费] 解释某个错误码含义 + 建议下一步动作。
无副作用、不扣费。告诉你这个码是什么、能不能重试、该怎么办、是否扣费。
Returns: data{ found, code, title, explanation, retryable, nextActions[], billing?, links? }。
Use when: 收到不懂的错误码想知道怎么办。`,
    en: `[Explain error · FREE] Explain what an error code means + suggested next action.
No side effects, no charge. Tells you what the code is, whether it's retryable, what to do, and any billing impact.
Returns: data{ found, code, title, explanation, retryable, nextActions[], billing?, links? }.
Use when: you got an error code you don't understand and want to know what to do.`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`explain_error: code=${input.code}`);
    const qs = buildQuery({ code: input.code });
    return ctx.client.get(`/api/v1/social/errors/explain${qs}`);
  },
};
