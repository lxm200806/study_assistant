# 权限与会员体系

## 一句话

**套餐只是权限的打包；业务代码只检查权限 key，不检查 `plan === 'premium'`。**

```text
Permission（权限目录）
  ▲
PlanPermission（套餐 → 权限映射）
  ▲
MembershipPlan（售卖套餐）
  ▲
Subscription / EntitlementGrant（账号实际授权）
  ▼
UsageCounter / CreditWallet（次数、AI 点数）
```

## 核心模型

| 表 | 作用 |
|---|---|
| `permissions` | 权限目录：`english.recognition`、`ai.chat.text` 等 |
| `membership_plans` | 套餐：免费、英语核心、SVIP、语文、数学、AI 包、加购包 |
| `plan_permissions` | 套餐包含哪些权限，可带次数/周期 |
| `subscriptions` | 账号购买/赠送的套餐周期，含权限快照 |
| `entitlement_grants` | 实际生效的权限授权，可来自订阅、试用、赠送、活动、管理员 |
| `usage_counters` | 通用配额计数（每日/每月次数） |
| `credit_wallets` / `credit_ledger` | AI 点数余额与流水 |

权限 key 定义在 `server/src/entitlements/permissions.ts`，前端镜像在 `src/utils/permissions.ts`。

## 当前种子套餐

| 套餐 | 状态 | 说明 |
|---|---|---|
| `free` | 启用 | 免费词书 + 认读/拼读/文章/测验 + 语文基线 + 文本 AI 5/天 + 语音 10/天 |
| `english_core_month/year` | 启用 | 全部英语词书 + 英语练习权限 + 高级统计 + 文本 AI 300/月 + 语音 300/月 |
| `english_svip_month/year` | 未启用 | 英语核心 + 游戏 + 语音 60 分钟/月 + 更高 AI 额度 |
| `chinese_core_month/year` | 未启用 | 语文课程、听写、背诵 |
| `math_beta` / `math_core_*` | 未启用 | 数学上线初期免费/后续付费 |
| `english_games_addon` | 未启用 | 单独解锁游戏 |
| `ai_voice_pack_*` | 未启用 | AI 语音点数包 |
| 旧 `premium_month/year` | 停售 | 历史订单保留，现有 premium 用户已迁移为英语核心授权 |

> 套餐的 `priceCents`、`days`、`active` 只在首次创建时写入；启动同步不会覆盖后台/管理接口的改价和上下架。`PlanPermission` 以代码为准同步。

## 权限解析规则

`server/src/entitlements/entitlement.service.ts`：

1. 管理员拥有全部权限。
2. `free` 套餐的权限作为隐式基线，不落授权记录。
3. 有效 `EntitlementGrant`（未过期）覆盖同名免费权限。
4. 多条授权同名时，取最大配额/最晚到期；额度使用按 `usage_counters` 扣除。
5. 账号级授权由所有孩子共享。

路由门禁使用 `requirePermission(key)`，例如：

- `english.books.all`：全部英语词书
- `english.recognition` / `english.typing` / `english.article`
- `chinese.courses`
- `ai.chat.text` / `ai.speech.assess`
- `stats.weekly`

动态训练接口按 `type` 映射为 `listening/speaking/recognition/writing` 权限。

## API

| 接口 | 说明 |
|---|---|
| `GET /api/entitlements` | 当前账号权限、订阅、AI 余额 |
| `GET /api/billing/plans` | 可购买套餐（含权限映射） |
| `POST /api/billing/orders` | 创建订单，保存套餐快照 |
| `POST /api/billing/orders/:id/pay` | mock 支付/真实支付确认入口（生产默认禁用 mock） |
| `GET /api/admin/plans` | 管理员查看全部套餐 |
| `PATCH /api/admin/plans/:code` | 管理员上下架/改价/改天数 |
| `GET /api/admin/entitlements?accountId=` | 管理员查看账号权限 |
| `POST /api/admin/entitlements/grant` | 管理员赠送权限 |
| `POST /api/admin/entitlements/revoke` | 管理员回收权限 |
| `POST /api/admin/credits/grant` | 管理员赠送 AI 点数 |

## 购买流程

```text
会员页 → 创建订单（快照套餐权限/价格）
      → 支付成功
      → 事务：订单 paid + Subscription + EntitlementGrant
      → 英语套餐同步兼容字段 User.plan/planExpiresAt
      → 前端刷新 /api/entitlements
```

- 同 `groupKey` 的套餐续费从当前到期时间继续延长。
- 已支付订单幂等，不重复授权。
- 退款/撤销：按 `sourceType/sourceId` 删除授权并调整订阅状态（真实支付接入后补全自动流程）。
- AI 点数包：订单支付后写 `credit_wallets` + `credit_ledger`，并授予 `ai.chat.voice` 等权限。

## 如何启用语文/数学/SVIP/AI 包

1. 用管理员接口或数据库把对应 `membership_plans.active` 改为 `true`。
2. 需要时通过 `PATCH /api/admin/plans/:code` 改价。
3. 语文/数学如果要从免费转收费，需要同时调整 `free` 套餐的权限映射（目前 `free` 包含语文基线），或给现有用户发限时 beta 授权；这部分是产品策略，不要只改价格。
4. AI 语音包使用 `creditAmount` 发放点数；真实语音陪聊上线后按分钟/点数消费。

## 当前未完成

- 真实微信/支付宝/IAP 渠道、回调验签、退款/对账。
- AI 语音陪聊本身（权限、点数、界面已预留）。
- 内容级免费/付费拆分（目前 `free` 套餐权限是账号级；词书用 `Book.isFree` 控制）。
- 单本词书购买入口（`UserBookUnlock` 已有表，未接购买流程）。
- 管理端页面（目前提供 API）。
