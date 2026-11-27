# 网页版微信支付接入

当前实现范围：**PC/H5 网页微信支付**。

- PC 浏览器：微信支付 **Native**，后端生成二维码，用户微信扫码。
- 手机浏览器：微信支付 **H5（MWEB）**，跳转微信收银台后返回。
- 支付结果：微信异步回调 + 前端轮询订单状态双保险。
- 小程序/App 的微信支付、支付宝、IAP 尚未接入。

## 需要准备

1. 微信支付商户号（`mchid`）。
2. 商户号关联的 appid（公众号/开放平台应用，用于网页支付）。
3. API v3 密钥（32 字节）。
4. 商户 API 证书：`apiclient_key.pem` 和证书序列号。
5. 微信支付平台证书（用于回调验签）：把 `证书序列号 -> 证书 PEM` 保存为 JSON。
6. 一个公网 HTTPS 回调地址，例如 `https://your-domain/api/billing/wechat/notify`。
7. H5 支付域名在商户平台配置；返回地址与支付域名匹配。

证书目录建议放 `server/certs/`（已 gitignore），不要提交。

## 环境变量

```env
PAYMENT_PROVIDER=wechat

WECHAT_PAY_MCHID=商户号
WECHAT_PAY_APPID=网页支付appid
WECHAT_PAY_API_V3_KEY=32字节APIv3密钥
WECHAT_PAY_MCH_SERIAL_NO=商户证书序列号
WECHAT_PAY_PRIVATE_KEY_PATH=./certs/apiclient_key.pem
# 也可以不用文件，直接把 PEM 放到 WECHAT_PAY_PRIVATE_KEY（\n 换行）

WECHAT_PAY_NOTIFY_URL=https://your-domain/api/billing/wechat/notify
WECHAT_PAY_PLATFORM_CERTS_PATH=./certs/platform-certs.json
# 或 WECHAT_PAY_PLATFORM_CERTS='{"序列号":"-----BEGIN CERTIFICATE-----\n..."}'

WECHAT_PAY_H5_APP_NAME=学习助手
WECHAT_PAY_H5_APP_URL=https://your-domain
WECHAT_PAY_H5_REDIRECT_URL=https://your-domain/#/pages/membership/membership
```

`platform-certs.json` 格式：

```json
{
  "微信平台证书序列号": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
}
```

微信平台证书会轮换，建议保留新旧多个序列号。

## 支付流程

```text
前端创建订单 POST /api/billing/orders
  → provider=wechat
  → POST /api/billing/orders/:id/wechat-pay { channel: native | h5 }
      Native: 返回 codeUrl + 服务端生成的 qrCodeDataUrl
      H5:     返回 h5Url
  → PC 展示二维码 / 手机跳转微信
  → 微信回调 POST /api/billing/wechat/notify
      验签 → AES-256-GCM 解密 → 校验 mchid/appid/金额/订单号
      → 订单 paid + Subscription + EntitlementGrant
  → 前端轮询 GET /api/billing/orders/:id
      发现 pending 会主动查询微信订单，成功后同样落库授权
```

- 回调路径不需要 Bearer token，但必须通过微信平台证书验签；原始请求体由 `express.json` 的 `verify` 保存为 `req.rawBody`。
- 回调会校验时间戳（5 分钟内），防重放。
- 回调和轮询都调用同一个幂等 `fulfillPaymentOrder`，重复通知不会重复授权。
- `/api/billing/orders/:id/pay` 仅供 mock 渠道；微信支付下会拒绝。

## 前端

- PC：`membership.vue` 走 `native`，展示 `qrCodeDataUrl`，每 2 秒轮询订单，成功后刷新权益。
- 手机浏览器：走 `h5`，跳转 `h5Url`；返回后页面重新加载权益。
- 微信内置浏览器不支持 H5 支付（需要公众号 JSAPI），当前提示用户使用系统浏览器或 PC 扫码。

## Docker 部署

API 容器内证书路径默认在 `/app/certs`。需要把证书目录挂载进容器，例如：

```yaml
services:
  api:
    volumes:
      - ./server/certs:/app/certs:ro
```

生产 `.env.prod` 使用：

```env
PAYMENT_PROVIDER=wechat
WECHAT_PAY_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem
WECHAT_PAY_PLATFORM_CERTS_PATH=/app/certs/platform-certs.json
```

Nginx 必须把 `WECHAT_PAY_NOTIFY_URL` 路径反代到 API；不要加额外鉴权。

## 测试

```bash
cd server
npx vitest run src/services/wechat-pay.service.test.ts
```

单元测试覆盖：

- 商户请求签名
- Native/H5 预支付参数
- 微信订单查询
- 回调解密与验签
- 错误响应映射

真实支付需要商户参数；建议先用最小金额测试退款/关闭订单（退款接口尚未接入）。
