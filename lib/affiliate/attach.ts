import { ApiError, v1 } from "../api/v1";
import { readRef } from "./ref";

const ATTACHED_KEY = "bb_ref_attached";

interface AttachTarget {
  /** Signed-in shopper. */
  bearerToken?: string | null;
  /** Guest cart. */
  orderToken?: string | null;
  /** Used to remember that this order already carries this code. */
  orderNumber?: string | null;
}

const remembered = (): string | null => {
  try {
    return window.localStorage.getItem(ATTACHED_KEY);
  } catch {
    return null;
  }
};

const remember = (key: string) => {
  try {
    window.localStorage.setItem(ATTACHED_KEY, key);
  } catch {
    // Storage blocked: the server ignores a repeat anyway.
  }
};

/**
 * Attaches the stored referral code to the current order
 * (`PATCH /api/v1/orders/current/affiliate`). Called on add to cart and at the
 * checkout address step. Never throws and never blocks the caller for long:
 * attribution is best effort, checkout is not.
 */
export async function attachRefToOrder(target: AttachTarget): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    const ref = readRef();
    if (!ref) return;
    if (!target.bearerToken && !target.orderToken) return;

    const orderKey = target.orderNumber || target.orderToken || "current";
    const key = `${orderKey}:${ref.code}`;
    if (remembered() === key) return;

    try {
      await v1("/orders/current/affiliate", {
        method: "PATCH",
        body: { code: ref.code },
        token: target.bearerToken || null,
        orderToken: target.bearerToken ? null : target.orderToken,
        timeoutMs: 5000
      });
      remember(key);
    } catch (e) {
      // 4xx means the server has decided (already attached, completed order,
      // unknown code): don't ask again for this order. Retry later otherwise.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        remember(key);
      }
    }
  } catch {
    // Attribution must never break the cart or checkout.
  }
}
