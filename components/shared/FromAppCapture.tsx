import { useEffect } from "react";
import { useRouter } from "next/router";
import { captureFromApp } from "@lib/fromApp";

/**
 * Remembers `?from=app` on any page for the browser session, so the order
 * confirmation page can offer "Open in Beeper". Renders nothing.
 */
export const FromAppCapture = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    captureFromApp(window.location.href);
  }, [router.isReady, router.asPath]);

  return null;
};

export default FromAppCapture;
