import { env } from "@/lib/env";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency?: string;
        callback?: () => void;
        onClose?: () => void;
      }) => { openIframe: () => void };
    };
  }
}

type CheckoutPayload = {
  authorizationUrl: string;
  reference: string;
  email?: string;
  amountKobo?: number;
  currency?: string;
  publicKey?: string;
};

function redirectToPaystack(authorizationUrl: string) {
  if (!authorizationUrl) {
    throw new Error("Missing Paystack authorization URL");
  }

  window.location.assign(authorizationUrl);
}

async function ensurePaystackScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.PaystackPop) {
    return true;
  }

  const existing = document.querySelector<HTMLScriptElement>('script[src=\"https://js.paystack.co/v1/inline.js\"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack script")), { once: true });
    }).catch(() => undefined);
    return Boolean(window.PaystackPop);
  }

  const script = document.createElement("script");
  script.src = "https://js.paystack.co/v1/inline.js";
  script.async = true;
  document.body.appendChild(script);

  await new Promise<void>((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Paystack script")), { once: true });
  }).catch(() => undefined);

  return Boolean(window.PaystackPop);
}

export async function startPaystackCheckout(payload: CheckoutPayload) {
  const publicKey = payload.publicKey || env.VITE_PAYSTACK_PUBLIC_KEY;

  if (publicKey && payload.email && payload.amountKobo && payload.reference) {
    const scriptReady = await ensurePaystackScript();
    if (scriptReady && window.PaystackPop) {
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: payload.email,
        amount: payload.amountKobo,
        ref: payload.reference,
        currency: payload.currency || "GHS",
        callback: () => {
          const url = new URL(`${env.VITE_SITE_URL}/orders`);
          url.searchParams.set("reference", payload.reference);
          window.location.assign(url.toString());
        }
      });

      handler.openIframe();
      return;
    }
  }

  redirectToPaystack(payload.authorizationUrl);
}

export function getPaystackPublicKey() {
  return env.VITE_PAYSTACK_PUBLIC_KEY ?? "";
}
