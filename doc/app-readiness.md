# App 与商业化就绪清单

当前已具备 App 构建脚手架，但商店发布和收款仍需要账号与证书。

## 已完成

- `src/manifest.json` 增加 `app-plus` 配置（Android 网络/录音权限，iOS 占位）。
- `npm run dev:app` / `npm run build:app` 使用 UniApp App 平台。
- `src/platform/payment.ts`、`src/platform/push.ts` 定义支付/推送边界，默认返回不可用。
- 服务端已实现会员套餐/订单、mock 支付开通和推送 token 注册；`PAYMENT_PROVIDER=mock` 仅用于本地/演示，生产环境默认禁用 mock 支付，需显式设置 `ALLOW_MOCK_PAYMENT=true` 才能开启。
- 网页版微信支付已接入（PC Native 扫码 / 手机 H5 跳转、回调验签、状态查询），配置见 `doc/wechat-pay.md`；小程序/App 微信支付、支付宝和 IAP 仍需单独接入。
- 跨端适配层已覆盖 storage/audio/stream，App 不需要直接调用 H5 API。

## 需要账号/证书

| 能力 | 需要 |
| --- | --- |
| Android 打包 | HBuilderX/云打包账号、签名证书、包名 |
| iOS 打包 | Apple Developer、证书、Provisioning Profile、App Store Connect |
| 微信支付 | 微信商户号、API v3 密钥、证书、回调域名 |
| 支付宝 | 开放平台应用、商户号、私钥 |
| Apple IAP | App Store Connect 内购项目、Shared Secret |
| 推送 | APNs Key、FCM 项目、国内厂商推送账号 |
| 合规 | 隐私政策、用户协议、ICP备案、软著、应用商店资质 |

## 接入顺序

1. 先确定 App 包名/Bundle ID 和发布渠道。
2. 用 HBuilderX 云打包验证 `build:app` 产物。
3. 接 `PushProvider`，在登录后注册 token 并上报服务端。
4. 接 `PaymentProvider`，服务端创建订单并校验回调；客户端只负责拉起支付。
5. 补会员权益、订单查询、退款/对账和商店合规页面。
