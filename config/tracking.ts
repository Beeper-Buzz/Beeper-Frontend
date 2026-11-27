export const GA_TRACKING_CODE = process.env.NEXT_PUBLIC_GA_TRACKING_CODE;
export const GA_DEBUG_MODE = process.env.NEXT_PUBLIC_GA_DEBUG_MODE;
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

// Pages whose URL carries a secret (the review link token from review request emails). Their
// URLs are redacted before any tracker sees them, and third-party pixels don't load on them
// (pages/_document.tsx).
export const PRIVATE_PAGE_PREFIXES = ["/review/"];

export const isPrivatePage = (path: string): boolean =>
  PRIVATE_PAGE_PREFIXES.some((prefix) => path.startsWith(prefix));

/** `/review/abc123?item=1` → `/review/[token]`; other URLs unchanged. */
export const redactTrackingUrl = (url: string): string =>
  url.replace(/^((?:https?:\/\/[^/]+)?\/review\/)[^/?#]+[^#]*/, "$1[token]");

/**
 * Sentry hooks (sentry.*.config.ts) that apply `redactTrackingUrl` to what
 * Sentry would otherwise send with a review link's token in it: the request
 * URL, the transaction name and navigation/fetch breadcrumbs.
 */
export const redactSentryEvent = <
  T extends { request?: { url?: string }; transaction?: string }
>(
  event: T
): T => {
  if (event.request?.url) {
    event.request.url = redactTrackingUrl(event.request.url);
  }
  if (event.transaction) {
    event.transaction = redactTrackingUrl(event.transaction);
  }
  return event;
};

export const redactSentryBreadcrumb = <
  T extends { data?: { [key: string]: any } }
>(
  breadcrumb: T
): T => {
  const data = breadcrumb.data;
  if (data) {
    ["from", "to", "url"].forEach((key) => {
      if (typeof data[key] === "string") {
        data[key] = redactTrackingUrl(data[key]);
      }
    });
  }
  return breadcrumb;
};

export enum Action {
  PRESS_ENTER = "press-enter",
  SELECT_SUGGESTION = "select-suggestion",
  VIEW_PRODUCT = "view-product"
}

export enum Category {
  SEARCH_BAR = "search-bar",
  PRODUCT_DETAIL = "product-detail"
}

const TRACKING_ON = process.env.NEXT_PUBLIC_TRACKING !== "off";
const TRACKING_VERBOSE = process.env.NEXT_PUBLIC_TRACKING_VERBOSE === "on";

const TRACKING_GA_ON = process.env.NEXT_PUBLIC_TRACKING_PROVIDER_GA !== "off";
const TRACKING_KM_ON = process.env.NEXT_PUBLIC_TRACKING_PROVIDER_KM !== "off";

type TrackingEvent = {
  action: string;
  category: string;
  label?: string;
};

interface TrackingProvider {
  getName(): string;
  isActive(): boolean;
  trackPageview(url: string): void;
  trackEvent({ action, category, label }: TrackingEvent): void;
}

declare global {
  interface Window {
    gtag: any;
  }
}

const googleAnalyticsProvider: TrackingProvider = {
  getName: (): string => {
    return "Google Analytics 4";
  },

  isActive: (): boolean => {
    return TRACKING_GA_ON;
  },

  trackPageview: (url: string): void => {
    if (typeof window !== "undefined") {
      window.gtag("config", GA_TRACKING_CODE, {
        page_path: url
      });
    }
  },

  trackEvent: ({ action, category, label }: TrackingEvent): void => {
    if (typeof window !== "undefined") {
      window.gtag("event", action, {
        event_category: category,
        event_label: label,
        value: 0
      });
    }
  }
};

const trackingProviders: Array<TrackingProvider> = [googleAnalyticsProvider];

export const trackPageview = (url: string): void => {
  if (!TRACKING_ON) {
    return;
  }

  for (let provider of trackingProviders) {
    if (provider.isActive()) {
      if (TRACKING_VERBOSE) {
        console.log(
          provider.getName() + " - trackPageview",
          redactTrackingUrl(url)
        );
      }

      provider.trackPageview(redactTrackingUrl(url));
    }
  }
};

export const trackEvent = ({
  action,
  category,
  label
}: TrackingEvent): void => {
  if (!TRACKING_ON) {
    return;
  }

  for (let provider of trackingProviders) {
    if (provider.isActive()) {
      if (TRACKING_VERBOSE) {
        console.log(provider.getName() + " - trackEvent", {
          action,
          category,
          label
        });
      }

      provider.trackEvent({ action, category, label });
    }
  }
};
