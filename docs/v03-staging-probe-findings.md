# DataScaler v0.3 staging 实测结论（2026-07-02）

> 以实测为准。所有端点已在 staging 验证可用。凭证/结构直接指导 Java + MCP 改造。

## 计费模型（核心变化）

- **公式**：`扣积分 = (1 + 竞品数) × 渠道数 × 页数 × 0.25`（所有渠道同价，Amazon 不计入）
  - 空间 quick(3页) 2渠道 = 2×3×0.25 = **1.5** credits（实测）
  - Anker refresh quick(3页) 6渠道 = 6×3×0.25 = **4.5** credits（实测）
  - 完整报告 4×7×10×0.25 = 70 credits
  - 空间 full 1×7×10×0.25 = 17.5 credits
- **计费落点**：采集**完成时**才扣（`chargedOn: "collection-completion"`）
- **预估 vs 实扣**：
  - 预估（采集前）：`data.billing.estimatedCredits`（建空间/refresh 响应）；prepare 的 `depthOptions[].estimatedCredits`
  - 实扣（完成后，权威）：`GET /refresh/{jobId}` → `data.billingIntent.chargedAmount`（`state=consumed` 后）
  - v1.0：`chargedAmount === estimatedCredits`（无实采校准）
- **建空间只占品牌位、不扣积分**（POST /spaces 本身 creditsCharged=0，采集完成才扣）
- **AI 分析**：额度优先、耗尽自动扣 1 credit/次（成功才扣）

## billingIntent 结构（GET /refresh/{jobId}）
```
billingIntent: { state:"pending"|"consumed", addons:[], chargedAmount:null|number, error, settledAt, createdAt }
```
采集中 pending/null；完成后 consumed + chargedAmount。

## 知识空间（默认接入）

### POST /spaces/prepare {query}（不扣费，出计划）
返回：`resolvedName, description, entityLevel, industryCandidates[], offeringCandidates[], suggestedKeywords[], brandKeywords[], defaultPlatforms[](7), optionalPlatforms[](threads,reddit), depthOptions[]{tier,maxPages,eta,approxPostsPerPlatform,isDefault,estimatedCredits}, cost, nextStep`
- depthOptions: quick(3页,20-30min,~8帖,5.25cr) / standard(5页,30-60min,~14帖,8.75cr) / full(10页,1-1.5h,~28帖,17.5cr) ← 这是 7 渠道默认的估算

### POST /spaces {name, industries*, ...}（建空间+首采）
- **industries 必填**（≥1），缺 → 400 `fieldErrors.industries:["Required"]`
- **不支持 amazon_reviews** → 400 友好 message + userMessageEn 引导 setup_brand
- platforms 可选（默认7社媒）；depth 可选默认 full；keywords 留空自动生成
- 返回：`spaceId(=brandId), name, keywords[], platforms[], depth, maxPages, collection{started,jobId,total,links}, billing{model:'flat-credits',estimatedCredits,chargedOn,note}`

## 其他新端点（全部 GET，200 实测）

| 端点 | 返回关键字段 |
|---|---|
| `GET /context` | identity, plan, quota{aiQuestions,refreshes,exports,brands}, credits, brands[], supportedPlatforms[]{id,name,type,defaultSelected,creditCost,requiresAsin} |
| `GET /actions` | tier, quota, credits, brandCount, nextActions[]{tool,label,reason,args} |
| `GET /errors/explain?code=` | found, code, title, explanation, retryable, nextActions[], billing?, links? |
| `GET /usage` | window, scope, totals, byTool[], quota, credits |
| `GET /usage/events?limit=&cursor=&tool=&status=` | events[]{id,tool,brandId,status,errorCode,creditsCharged,latencyMs,createdAt,toolLabel}, nextCursor |
| `GET /brands/{id}/diagnose` | brandId, dataReady, freshnessVerdict, ageDays, totalPosts, configuredPlatforms[], recommendedPlatformsToRefresh[], quotaOkForRefresh, lastRefreshJobId, nextActions[] |
| `GET /refresh/{jobId}/wait?timeoutSeconds=N` | 同 refresh 进度，短等超时返回当前 |

## refresh 变化
- `POST /brands/{id}/refresh {depth:'quick'|'standard'|'full'}` 或 `{maxPages:1-10}` → 返回 `billing.estimatedCredits`
- 响应含 `billing{model,estimatedCredits,chargedOn,note}`

## idempotencyKey
- 实测传了**不报 400**（schema 宽松，静默忽略）。文档说 🔜 规划中。**MCP 侧移除该字段更干净**（避免误导 AI 以为有幂等保证）。

## 错误结构（比契约丰富）
`{ok:false, code, status, message, userMessage, userMessageEn, retryable, nextActions:[{tool,label,reason}], billing?, links?}`
- analyze 同步返回 report（上一版实测，v0.3 未变）
- refresh/spaces 异步返 jobId
