/**
 * Aliyun SMS Provider
 *
 * Sends verification codes via the Aliyun Dysms (Short Message Service) API.
 * Uses direct HTTP calls (fetch) rather than the SDK to avoid a heavy dependency.
 *
 * Required environment variables:
 *   ALIYUN_SMS_ACCESS_KEY_ID
 *   ALIYUN_SMS_ACCESS_KEY_SECRET
 *   ALIYUN_SMS_SIGN_NAME          — SMS signature name
 *   ALIYUN_SMS_TEMPLATE_CODE      — Template code that contains a ${code} placeholder
 *
 * Optional:
 *   ALIYUN_SMS_ENDPOINT           — defaults to https://dysmsapi.aliyuncs.com
 */

import crypto from "crypto";
import type { SMSProvider } from "../index";

// ---------------------------------------------------------------------------
// Helpers for Aliyun OpenAPI signature (V1.0 signed GET)
// ---------------------------------------------------------------------------

const DEFAULT_ENDPOINT = "https://dysmsapi.aliyuncs.com";

interface AliyunConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  endpoint: string;
}

function getConfig(): AliyunConfig {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ?? "";
  const signName = process.env.ALIYUN_SMS_SIGN_NAME ?? "";
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE ?? "";
  const endpoint = process.env.ALIYUN_SMS_ENDPOINT || DEFAULT_ENDPOINT;

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error(
      "Aliyun SMS: missing required env vars " +
        "(ALIYUN_SMS_ACCESS_KEY_ID, ALIYUN_SMS_ACCESS_KEY_SECRET, " +
        "ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_CODE)",
    );
  }

  return { accessKeyId, accessKeySecret, signName, templateCode, endpoint };
}

/**
 * Percent-encode per RFC 3986 (used by Aliyun signature).
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E");
}

/**
 * Build the Authorization header value for Aliyun OpenAPI V1.0.
 */
function sign(
  params: Record<string, string>,
  accessKeySecret: string,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");

  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(sorted)}`;
  const hmac = crypto.createHmac("sha1", accessKeySecret + "&");
  hmac.update(stringToSign);
  return hmac.digest("base64");
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class AliyunSMSProvider implements SMSProvider {
  async sendCode(
    phone: string,
    code: string,
    _purpose: string,
  ): Promise<{ success: boolean; requestId?: string }> {
    const cfg = getConfig();

    const params: Record<string, string> = {
      Action: "SendSms",
      Format: "JSON",
      Version: "2017-05-25",
      AccessKeyId: cfg.accessKeyId,
      SignatureMethod: "HMAC-SHA1",
      SignatureVersion: "1.0",
      SignatureNonce: crypto.randomUUID(),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      // Business params
      PhoneNumbers: phone,
      SignName: cfg.signName,
      TemplateCode: cfg.templateCode,
      TemplateParam: JSON.stringify({ code }),
    };

    const signature = sign(params, cfg.accessKeySecret);
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const url = `${cfg.endpoint}/?Signature=${encodeURIComponent(signature)}&${qs}`;

    try {
      const res = await fetch(url, { method: "GET" });
      const body = (await res.json()) as {
        Code?: string;
        RequestId?: string;
        Message?: string;
      };

      if (body.Code === "OK") {
        return { success: true, requestId: body.RequestId };
      }

      console.error(
        `[AliyunSMS] send failed: Code=${body.Code} Message=${body.Message}`,
      );
      return { success: false, requestId: body.RequestId };
    } catch (err) {
      console.error("[AliyunSMS] request error:", err);
      return { success: false };
    }
  }
}
