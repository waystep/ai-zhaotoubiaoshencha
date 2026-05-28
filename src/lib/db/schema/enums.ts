import { pgEnum } from "drizzle-orm/pg-core";

// ==================== 认证相关枚举 ====================

/** 登录方式 */
export const loginMethodEnum = pgEnum("login_method", [
  "password",      // 密码登录
  "phone_sms",     // 手机短信验证码
  "feishu_oauth",  // 飞书 OAuth
  "wechat_oauth",  // 微信 OAuth
  "sso_saml",      // SAML SSO
  "sso_oidc",      // OIDC SSO
]);

/** 验证码用途 */
export const smsPurposeEnum = pgEnum("sms_purpose", [
  "login",           // 登录
  "register",        // 注册
  "reset_password",  // 重置密码
  "bind_phone",      // 绑定手机号
]);
