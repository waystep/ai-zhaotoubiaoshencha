/**
 * SMS Service — 短信验证码服务
 *
 * Provides an abstraction over SMS providers (Aliyun, mock, etc.)
 * and utilities for generating / expiring verification codes.
 */

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface SMSProvider {
  /**
   * Send a verification code to the given phone number.
   *
   * @param phone  - E.164 or raw Chinese 11-digit mobile number
   * @param code   - The verification code to send
   * @param purpose - One of "login" | "register" | "reset" | "bind_phone"
   * @returns success flag and optional provider request-id for tracking
   */
  sendCode(
    phone: string,
    code: string,
    purpose: string,
  ): Promise<{ success: boolean; requestId?: string }>;
}

// ---------------------------------------------------------------------------
// SMS Service
// ---------------------------------------------------------------------------

export class SMSService {
  private provider: SMSProvider;
  private codeLength = 6;
  private codeExpiryMinutes = 5;

  constructor(provider: SMSProvider) {
    this.provider = provider;
  }

  /** Generate a numeric verification code of the configured length. */
  generateCode(): string {
    const max = Math.pow(10, this.codeLength); // e.g. 1_000_000
    return Math.floor(Math.random() * max).toString().padStart(this.codeLength, "0");
  }

  /** Expiry duration in minutes — used when persisting codes. */
  getExpiryMinutes(): number {
    return this.codeExpiryMinutes;
  }

  /** Delegate sending to the configured provider. */
  async sendCode(
    phone: string,
    code: string,
    purpose: string,
  ): Promise<{ success: boolean; requestId?: string }> {
    return this.provider.sendCode(phone, code, purpose);
  }
}

// ---------------------------------------------------------------------------
// Mock provider (used when SMS_PROVIDER is not set or set to "mock")
// ---------------------------------------------------------------------------

class MockSMSProvider implements SMSProvider {
  async sendCode(
    phone: string,
    code: string,
    purpose: string,
  ): Promise<{ success: boolean; requestId?: string }> {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[MockSMS] phone=${phone} code=${code} purpose=${purpose}`);
    }
    return { success: true, requestId: `mock-${Date.now()}` };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an SMSService based on the `SMS_PROVIDER` environment variable.
 *
 * Supported values:
 *   - "aliyun"  — Aliyun Dysms API (direct HTTP)
 *   - "mock" / undefined — logs the code to stdout (dev only)
 */
export function createSMSService(): SMSService {
  const providerName = (process.env.SMS_PROVIDER ?? "mock").toLowerCase();

  let provider: SMSProvider;

  switch (providerName) {
    case "aliyun": {
      // Dynamic import keeps the Aliyun module out of the bundle when
      // not needed, but we still require it synchronously for simplicity.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AliyunSMSProvider } = require("./providers/aliyun");
      provider = new AliyunSMSProvider();
      break;
    }
    default:
      provider = new MockSMSProvider();
      break;
  }

  return new SMSService(provider);
}
