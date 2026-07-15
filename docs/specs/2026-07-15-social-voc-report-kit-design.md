# 接入 `get_social_voc_report_kit`(免费社媒 VOC 报告套件)· 设计文档

> 日期:2026-07-15 · schema 契约:`social-voc-report-kit.v1.2`
> 关联接入指南:`D:\larkDownload\partner-social-voc-report-kit-接入指南.md`
> 关联现有设计:`docs/specs/2026-06-29-social-insights-mcp-design.md`

---

## 1. 背景与目标

DataScaler 新增一个 **免费** 的 Partner 能力:一次调用拿到「报告套件 JSON」(reportSpec + 模块数据 + 叙述 + 样式 CSS + 装配提示),由**本地 AI 装配成完整 HTML** 报告交给终端用户。

- Partner REST:`GET /partner/v1/brands/{id}/social-voc-report-kit`
- MCP 工具名(固定):`get_social_voc_report_kit`
- **计费:免费**(不扣 Credits、不占 AI 问答额度)。

**为什么重要**:此前出 VOC 报告只有两条路——路径 A(`analyze_brand`,扣 600 积分、口径窄、固定口吻)和路径 B(纯免费只读工具自产,叙事全靠 agent)。report kit 是**第三条路 = A 的官方成品质量 + B 的零费用**,故本次将其升为**出报告的首选默认路径**。

**目标**:在不改鉴权、不改既有采集/读接口的前提下,MCP 新增该工具、scrapeapi 新增转发端点,先指向 **staging** DataScaler 联调验证,**暂不上生产**(等 DataScaler 生产就绪再切)。

## 2. 前置探查结论(已实测 staging)

| 项 | 结论 |
|----|------|
| staging OAuth 换 token | 必须 **HTTP Basic Auth**(client 凭证放 header,body 只带 grant_type)。scrapeapi `TokenManager` 本就如此,无需改。 |
| 新端点是否部署 | **已在 staging 部署**:打不存在 brandId 返回结构化 `BRAND_NOT_FOUND`(HTTP 404,含 ok/code/status/userMessage/userMessageEn/nextActions),非路由级 404。 |
| 错误信封 | 与现有端点一致 → scrapeapi 现有 `mapBizCode`/`mapHttpStatus` 已能处理绝大多数码(BRAND_NOT_FOUND/DATA_NOT_READY/REFRESH_IN_PROGRESS/429 等)。**唯一缺口**:`TOOL_NOT_FOUND`(能力未部署)未映射,生产切换窗口会命中,§6 补一条。 |
| staging 数据 | 品牌数据按 externalUserId 隔离,现无有数据品牌;成功响应体结构以文档 §3 契约为准,真实核对留待联调(不阻塞开发)。 |

## 3. 范围决策(已与用户确认)

1. **落地范围** = 两仓都改 + 先指向 staging 联调,暂不上生产。
2. **联调方式** = 直接用 staging 凭证 curl 打 DataScaler staging 验证契约(本地无 scrapeapi dev 环境)。
3. **报告默认路径** = report kit 升为出报告**首选**;`analyze_brand` 降为「要额外深度策略结论才花 600 积分」的进阶项;免费只读工具仍作补强(引文/图表/趋势/风险样本)。
4. **工具定位(方案甲)** = 装配职责显式化:工具描述里**写死交付铁律**(调后必须装配成完整 HTML,禁止只用 Markdown;务必遵循返回体的 delivery/assemblyHints/style)。

## 4. 改动清单

### 4.1 scrapeapi(Java 转发层)— 3 文件

**`SocialController.java`**:新增
```java
@GetMapping("/brands/{brandId}/social-voc-report-kit")
public Mono<ApiResponse<JSONObject>> getSocialVocReportKit(
        @PathVariable String brandId,
        @RequestParam(required = false) Integer days,
        @RequestParam(required = false) String filterBy,
        @RequestParam(required = false) String lang,
        @RequestParam(required = false) Boolean forceRefresh) {
    JSONObject q = new JSONObject();
    if (days != null) q.put("days", days);
    putIfPresent(q, "filterBy", filterBy);
    putIfPresent(q, "lang", lang);
    if (forceRefresh != null) q.put("forceRefresh", forceRefresh);
    return socialService.getSocialVocReportKit(requireUserId(), brandId, q).map(this::purifySuccess);
}
```
放在「数据(只读)」段末尾(与其他免费只读端点同组)。免费:走 `requireUserId()`(不需 token,不进扣费)。

**`SocialService.java`**:接口加
```java
/** 社媒 VOC 报告套件(免费)。返回 reportSpec+模块数据+叙述+样式+装配提示,供本地 AI 装配 HTML。 */
Mono<JSONObject> getSocialVocReportKit(String userId, String brandId, JSONObject query);
```

**`SocialServiceImpl.java`**:实现(与 getMetrics 同型,免费只读)
```java
@Override
public Mono<JSONObject> getSocialVocReportKit(String userId, String brandId, JSONObject query) {
    return client.get("/brands/" + encPath(brandId) + "/social-voc-report-kit" + qs(query), userId);
}
```

### 4.2 scrapeapi purify 定向豁免（DataScalerClient.java）— 关键改动

**问题**:`purifyText()` 对**每个字符串值**做 `credits→points`、`dashboard→...`、`Credit→Point` 等替换(DataScalerClient.java:228-233;数组元素在 L248-249,**无 key**)。report kit 含大段大文本:`style.cssSnippet`/`style.tokens.{--ds-bg…}`/`style.classMap.{…}`、`assemblyHints.systemPromptFragment`/`chartHints`/`emptyStates`/`sectionLabels`、`modules[].narrative.markdown`/`narrative.bullets[]`、`delivery.instruction`/`delivery.doNot[]`,含 "credit"/"dashboard" 字样会被误替换,破坏 CSS/叙述。

**⚠️ spec review 修正**:最初设想的「扁平叶子字段名豁免」**不够**——它只按字符串的**直接父 key**判断,而上面很多可损坏字符串藏在容器**再下一层**(如 `style.tokens` 的值 key 是 `--ds-bg`,`emptyStates` 内是任意子 key,`bullets`/`doNot` 是**字符串数组**根本无 key)。扁平集合放行不了这些。

**方案(子树作用域豁免)**:一旦进入某个「非计费大文本容器」,对**整个子树**跳过 `purifyText`。给 `purifyNode` 加一个 `inExemptSubtree` 布尔参数向下传递:
```java
private static final Set<String> EXEMPT_SUBTREE_KEYS = Set.of(
    "style", "assemblyHints", "reportSpec", "delivery");  // narrative 见下
private void purifyNode(Object node) { purifyNode(node, false); }
private void purifyNode(Object node, boolean inExemptSubtree) {
    if (node instanceof Map) {
        Map obj = (Map) node;
        // A 类账户字段剥离 + B 类 credits→points 数值换算:照常执行(不受豁免影响)。
        ...(现有 A/B 逻辑不动)...
        // C 类字符串文案替换:仅当不在豁免子树内才做。
        if (!inExemptSubtree) {
            for (Object key : obj.keySet()) {
                Object value = obj.get(key);
                if (value instanceof String) obj.put(key, purifyText((String) value));
            }
        }
        // 递归:子节点若键名命中 EXEMPT_SUBTREE_KEYS(或已在豁免子树内),整棵子树豁免。
        for (Object key : obj.keySet()) {
            boolean childExempt = inExemptSubtree
                || EXEMPT_SUBTREE_KEYS.contains(String.valueOf(key))
                || "narrative".equals(String.valueOf(key));
            purifyNode(obj.get(key), childExempt);
        }
        removeIfEmptyObject(obj, "billing"); ...
    } else if (node instanceof List) {
        for (...) { if (item instanceof String && !inExemptSubtree) list.set(i, purifyText(...));
                    else purifyNode(item, inExemptSubtree); }
    }
}
```
> 关键正确性(review 已核实):A 类(账户字段剥离)与 B 类(credits→points 数值换算)是**按 key 名判断**的,**不经 purifyText**(DataScalerClient.java:195-226),所以子树豁免**只**关掉 C 类字符串替换,不削弱防泄漏与计费换算。且按文档 §3,这些子树内**不含**计费/账户字段,豁免安全。未知字段仍原样保留。
> 豁免根键:`style` / `assemblyHints` / `reportSpec` / `delivery` / `narrative`。`meta` **不**豁免(可能带上游账户字段,需照常剥离)。

### 4.3 MCP（TS）— 2 文件 + 引导

**新建 `src/tools/get_social_voc_report_kit.ts`**:照 `get_brand_metrics.ts` 模式。
- input schema:`brandId`(必填 string)、`days`(int 1..365,可选)、`filterBy`(`collected|published`,可选 enum)、`lang`(string,可选,默认随用户语言)、`forceRefresh`(boolean,可选)。
- execute:`buildQuery({ days, filterBy, lang, forceRefresh })` → `ctx.client.get("/api/v1/social/brands/{id}/social-voc-report-kit"+qs)`。
- description（中英双语，方案甲写死交付铁律）要点:
  - `[VOC 报告套件 · 免费]` 一次拿到可装配的报告套件(reportSpec/模块数据/叙述/CSS/装配提示)。
  - **交付铁律**:调用后**必须**把 kit 装配成完整 HTML 文档(` ```html ` 或 `.html` 产物)交给用户;**禁止**只用 Markdown 标题/表格充当完整报告。
  - 装配时务必遵循返回体的 `delivery.instruction` + `assemblyHints.systemPromptFragment` + `style.cssSnippet/tokens/classMap` + `reportSpec` + `modules`。
  - 铁律·不编造:`modules[].data` 里没有的数字/引文不得编造。
  - 前置:品牌需已采集完成;data not ready / refresh in progress → 先 refresh + get_refresh_progress。
  - 免费,**不要**引导用户为报告本身充值。
  - `schemaVersion` 用 `startsWith("social-voc-report-kit.v1")` 判断,按 `id` 查 module,别写死下标。

**`src/tools/index.ts`**:import `getSocialVocReportKit`,append 到数组「分析」段、`analyzeBrand` **之前**(新首选)。工具数 25 → 26。

**`src/server.ts` SERVER_INSTRUCTIONS**:重写「产出 VOC 报告」段(中英双语):
- 【默认首选:免费官方报告套件】出 VOC 报告默认先用 `get_social_voc_report_kit`(免费),拿到 kit 后按其 delivery/assemblyHints/style 装配完整 HTML。
- 【进阶付费选项】只有当用户明确想要额外的深度策略结论/自由提问式分析时,才提 `analyze_brand`(扣 600 积分,调前必须确认)。不再把 analyze_brand 当默认。
- 【免费补强仍保留】report kit 装配后可再用免费只读工具(metrics/sentiment/risk_alerts/posts/voice_share/summary)补真实引文、分平台明细、72h 高风险样本、趋势图。
- 保留:不编造铁律、图表可视化、每块数据配 so-what、refreshing 锁绕行。
- 兜底 B(纯自产)保留为「report kit 不可用或用户另有定制需求」时的退路。

## 5. 数据流

```
终端用户「出一份社媒 VOC 报告」
  → MCP get_social_voc_report_kit(brandId, days?, lang?)
  → GET /api/v1/social/brands/{id}/social-voc-report-kit?...   (scrapeapi)
  → SocialController → SocialService → DataScalerClient.get(...)
  → GET /partner/v1/brands/{id}/social-voc-report-kit  (DataScaler staging, Bearer + X-External-User-Id)
  → 响应 kit JSON → purify(定向豁免大文本字段) → ApiResponse.success
  → MCP 返回 kit → agent 按 delivery/assemblyHints/style 装配完整 HTML → 交付用户
```

## 6. 错误处理

复用现有链路,基本无需新增:
- `DATA_NOT_READY` / `REFRESH_IN_PROGRESS`(409)→ 现有 `mapBizCode` 已映射,引导先 refresh/查进度。
- `BRAND_NOT_FOUND`(404)→ 现有映射,已实测。
- `429` 限流 → 现有 `SOCIAL_RATE_LIMITED`;工具描述提醒节制 `forceRefresh`。
- 部分模块 `status=failed` 但 `ok:true` → 属正常「尽力返回」,agent 应降级渲染已有 module、展示 error 提示(写进工具描述与引导)。
- **新增一条映射(为生产切换窗口铺路)**:文档 §7 把 `TOOL_NOT_FOUND` 与 `BRAND_NOT_FOUND` 并列为「环境未部署该能力」(404)。现有 `mapBizCode` **无** `TOOL_NOT_FOUND` case → 落 default → `SOCIAL_SERVICE_UNAVAILABLE`(误导为"服务不可用/可重试")。staging 端点已部署不会触发,但**生产切换前**(§8 明确延后上生产)正是这条会命中的窗口。故 `DataScalerClient.mapBizCode` 加一条 `case "TOOL_NOT_FOUND": → SOCIAL_BRAND_NOT_FOUND`(或等价"能力未就绪"语义),让那段时间用户看到的是"该能力暂不可用",而非误导性可重试。

## 7. 测试与验证

1. `npm run typecheck && npm run build`(MCP)。
2. stdio 起 `dist/server.mjs`,`tools/list` 确认出现 `get_social_voc_report_kit`(26 工具),并**分别验 en/zh locale** 的 instructions 含新报告引导。
3. scrapeapi:`mvn compile`(dev profile)编译通过。
4. **联调(需有数据品牌)**:staging 建空间采集 → 完成后 `GET .../social-voc-report-kit` 拿成功响应体,核对 §3 契约字段,并确认 purify 后 cssSnippet/narrative 未被误伤、账户字段已剥离、计费字段(若有)已 credits→points。
5. 错误路径:错误 brandId → BRAND_NOT_FOUND;无数据品牌 → DATA_NOT_READY。

## 8. 部署（本轮不执行,记录时序）

先 staging 联调通过 → 待 DataScaler **生产**部署该端点后 → scrapeapi build+push ACR + ACK 改 tag + MCP `scripts/window/docker-mcp.sh <tag>` build+push + ACK 改 tag → 生产 voc.pangolinfo.com 验证。版本:MCP 拟 v0.4.0(新增工具 + 报告默认路径翻转)。

## 9. 非目标（YAGNI）

- 不实现服务端直出 HTML(产品边界是 kit JSON + 本地装配,见文档 FAQ)。
- 不做「三路让用户自选」(老板后续意图,本轮按「新工具当默认首选」;若后续要改,只动引导文案)。
- 不改任何既有工具的 schema / 计费。
- 不上生产。

**已知限制(本轮不修,记录在案)**:`purifyText` 对**非豁免**字段(如 `meta.keywords`、`meta.brandName`、`modules[].data` 里的普通字符串)仍做 `credit→point`/`Credit→Point` 替换。若品牌名/关键词字面含 "credit"(如 fintech 品牌 "Credit Karma" → 会被写成 "Point Karma"),是一个真实的数据完整性瑕疵,且"不编造铁律"无法捕捉。这是**既有问题**(metrics/posts 今天也有),report kit 因大量透出品牌自有词汇而放大概率。本轮 staging 范围内不阻塞;若实测撞到,后续可把 `keywords`/`brandName` 也纳入豁免,或改用更精确的计费文案定位(而非全局字符串 replace)。
