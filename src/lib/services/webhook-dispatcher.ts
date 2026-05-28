/**
 * Webhook Dispatcher — M7 Integration Module
 *
 * Handles webhook event dispatching:
 * - Loads active webhook configs for the target event type
 * - Signs payloads with HMAC-SHA256 for verification
 * - Delivers with configurable retry logic (exponential backoff)
 * - Logs all delivery attempts for monitoring
 */

import { createHmac } from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { webhooks, webhookDeliveryLogs } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Webhook = InferSelectModel<typeof webhooks>;
type WebhookEvent = "analysis.completed" | "draft.generated" | "review.completed" | "report.completed";

interface DispatchPayload {
  event: WebhookEvent;
  projectId: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WebhookDispatcher {
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(maxRetries = 3, baseDelayMs = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  // -----------------------------------------------------------------------
  // Dispatch an event to all matching webhooks
  // -----------------------------------------------------------------------

  async dispatch(payload: DispatchPayload): Promise<void> {
    // Find all active webhooks that subscribe to this event
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.isActive, true),
          // JSON containment check: events array contains this event type
        ),
      );

    // Filter in JS since Drizzle doesn't easily query JSON arrays
    const matchingWebhooks = activeWebhooks.filter((w) => {
      const events = w.events as string[];
      return events.includes(payload.event);
    });

    if (matchingWebhooks.length === 0) return;

    // Dispatch to all matching webhooks in parallel
    await Promise.allSettled(
      matchingWebhooks.map((w) => this.deliver(w, payload)),
    );
  }

  // -----------------------------------------------------------------------
  // Deliver to a single webhook with retry
  // -----------------------------------------------------------------------

  private async deliver(webhook: Webhook, payload: DispatchPayload): Promise<void> {
    const body = JSON.stringify({
      event: payload.event,
      projectId: payload.projectId,
      timestamp: new Date().toISOString(),
      data: payload.data,
    });

    const signature = webhook.secret
      ? this.sign(body, webhook.secret)
      : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": payload.event,
      "X-Webhook-Signature": signature ?? "",
      ...(webhook.headers as Record<string, string> ?? {}),
    };

    let lastError: Error | null = null;
    let attemptCount = 0;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      attemptCount = attempt + 1;
      const start = Date.now();

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        const durationMs = Date.now() - start;
        const responseBody = await response.text().catch(() => "");
        const success = response.status >= 200 && response.status < 300;

        // Log the delivery attempt
        await this.logDelivery({
          webhookId: webhook.id,
          event: payload.event,
          projectId: payload.projectId,
          requestPayload: JSON.parse(body),
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 2000),
          durationMs,
          success,
          attemptCount,
        });

        if (success) return;

        lastError = new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
      } catch (err) {
        const durationMs = Date.now() - start;
        lastError = err instanceof Error ? err : new Error(String(err));

        // Log the failed attempt
        await this.logDelivery({
          webhookId: webhook.id,
          event: payload.event,
          projectId: payload.projectId,
          requestPayload: JSON.parse(body),
          responseStatus: null,
          responseBody: lastError.message,
          durationMs,
          success: false,
          attemptCount,
        });
      }

      // Exponential backoff before retry
      if (attempt < this.maxRetries - 1) {
        const delay = this.baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error(
      `[webhook] All ${attemptCount} attempts failed for webhook ${webhook.id}: ${lastError?.message}`,
    );
  }

  // -----------------------------------------------------------------------
  // Test a webhook (single attempt, no retry)
  // -----------------------------------------------------------------------

  async testDelivery(webhook: Webhook): Promise<{
    success: boolean;
    status: number | null;
    durationMs: number;
    responseBody: string;
  }> {
    const testPayload = {
      event: "test",
      projectId: "test",
      timestamp: new Date().toISOString(),
      data: { message: "Test delivery from Smart Tender Review" },
    };

    const body = JSON.stringify(testPayload);
    const signature = webhook.secret ? this.sign(body, webhook.secret) : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": "test",
      "X-Webhook-Signature": signature ?? "",
      ...(webhook.headers as Record<string, string> ?? {}),
    };

    const start = Date.now();
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      const responseBody = await response.text().catch(() => "");
      const durationMs = Date.now() - start;
      const success = response.status >= 200 && response.status < 300;

      return { success, status: response.status, durationMs, responseBody: responseBody.slice(0, 2000) };
    } catch (err) {
      const durationMs = Date.now() - start;
      return {
        success: false,
        status: null,
        durationMs,
        responseBody: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // -----------------------------------------------------------------------
  // HMAC-SHA256 signing
  // -----------------------------------------------------------------------

  private sign(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  // -----------------------------------------------------------------------
  // Log a delivery attempt
  // -----------------------------------------------------------------------

  private async logDelivery(params: {
    webhookId: string;
    event: string;
    projectId: string;
    requestPayload: unknown;
    responseStatus: number | null;
    responseBody: string;
    durationMs: number;
    success: boolean;
    attemptCount: number;
  }): Promise<void> {
    try {
      await db.insert(webhookDeliveryLogs).values({
        webhookId: params.webhookId,
        event: params.event as WebhookEvent,
        projectId: params.projectId,
        requestPayload: params.requestPayload,
        responseStatus: params.responseStatus,
        responseBody: params.responseBody,
        durationMs: params.durationMs,
        success: params.success,
        attemptCount: params.attemptCount,
      });
    } catch (err) {
      console.error("[webhook] Failed to log delivery:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const webhookDispatcher = new WebhookDispatcher();
