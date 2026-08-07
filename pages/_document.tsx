import Document, {
  Html,
  Main,
  NextScript,
  Head,
  DocumentContext
} from "next/document";
import uaParser from "ua-parser-js";
import {
  Context as ResponsiveContext,
  MediaQueryAllQueryable
} from "react-responsive";
import * as React from "react";
import * as tracking from "../config/tracking";
import * as constants from "../utilities/constants";

const withResponsiveContext = (App: any, req: any) => {
  const contextValue = (() => {
    if (!req) {
      // it's a static render, when no req https://github.com/vercel/next.js/issues/7791
      return;
    }
    const { device } = uaParser(req.headers["user-agent"]);
    const isMobile = device.type === "mobile";
    return { width: isMobile ? 767 : 768 };
  })();
  return (props: any) =>
    typeof window !== "undefined" ? (
      <App {...props} />
    ) : (
      ((
        <ResponsiveContext.Provider
          value={contextValue as MediaQueryAllQueryable}
        >
          <App {...props} />
        </ResponsiveContext.Provider>
      ) as React.ReactElement)
    );
};

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const originalRenderPage = ctx.renderPage;

    ctx.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => withResponsiveContext(App, ctx.req)
      });

    const initialProps = await Document.getInitialProps(ctx);

    return initialProps;
  }
  render() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://beeper.buzz";
    const siteTitle =
      process.env.NEXT_PUBLIC_PAGE_TITLE ||
      process.env.NEXT_PUBLIC_SITE_TITLE ||
      "Beeper";
    const siteDesc =
      process.env.NEXT_PUBLIC_PAGE_DESC ||
      process.env.NEXT_PUBLIC_SITE_DESC ||
      "Play With Music";
    const sitePhone = process.env.NEXT_PUBLIC_PHONE || "+1-917-300-8103";
    const ogImgPath =
      process.env.NEXT_PUBLIC_OG_IMG_PATH || "/images/beeper-og-image.png";
    const ogImgWidth = process.env.NEXT_PUBLIC_OG_IMG_WIDTH || "512";
    const ogImgHeight = process.env.NEXT_PUBLIC_OG_IMG_HEIGHT || "211";
    const twitterSlug = process.env.NEXT_PUBLIC_TWITTER_SLUG || "beeper.buzz";
    const facebookSlug = process.env.NEXT_PUBLIC_FACEBOOK_SLUG || "beeper.buzz";

    const OpenGraphObject = `
        "@context": "http://schema.org",
        "@type": "Organization",
        "url": "${siteUrl}",
        "contactPoint": [{
          "@type": "ContactPoint",
          "telephone": "${sitePhone}",
          "contactType": "General Inquiry"
        }]
      `;

    const FacebookPixelObject = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${tracking.FB_PIXEL_ID}');
        fbq('track', 'PageView');
      `;

    return (
      <Html className="dark">
        <Head>
          <meta charSet="utf-8" />
          <meta name="description" content={siteDesc} />
          <meta name="keywords" content="" />
          <meta name="robots" content="noodp" />
          <meta property="og:locale" content="en_US" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={siteTitle} />
          <meta property="og:site_name" content={siteTitle} />
          <meta property="og:description" content={siteDesc} />
          <meta property="og:url" content={siteUrl} />

          <meta property="og:image" content={`${siteUrl}${ogImgPath}`} />
          <meta property="og:image:width" content={ogImgWidth} />
          <meta property="og:image:height" content={ogImgHeight} />

          <meta
            property="article:publisher"
            content={`https://www.facebook.com/${facebookSlug}`}
          />

          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:description" content={siteDesc} />
          <meta name="twitter:title" content={siteTitle} />
          <meta name="twitter:site" content={siteUrl} />
          <meta name="twitter:image" content={`${siteUrl}${ogImgPath}`} />

          <meta name="twitter:creator" content={`@${twitterSlug}`} />

          <link rel="icon" href="/img/favicon.ico" />
          <link rel="canonical" href={siteUrl} />
          <link rel="pingback" href={siteUrl} />
          {/* Non-critical CSS — loaded async after first paint */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  var sheets = [
                    '//cdn-images.mailchimp.com/embedcode/classic-10_7.css',
                    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css',
                    'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap'
                  ];
                  sheets.forEach(function(href){
                    var l = document.createElement('link');
                    l.rel = 'stylesheet';
                    l.href = href;
                    document.head.appendChild(l);
                  });
                })();
              `
            }}
          />
          <script type="application/ld+json">{OpenGraphObject}</script>
          {/* Stripe — defer until needed (checkout page loads it) */}
          <script src="https://js.stripe.com/v3/" defer></script>
          {/* Analytics — all async/defer, non-blocking */}
          <script
            async
            src={
              "https://www.googletagmanager.com/gtag/js?id=" +
              tracking.GA_TRACKING_CODE
            }
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', "${tracking.GA_TRACKING_CODE}", {
                  'send_page_view': true,
                  'page_path': window.location.pathname,
                  'debug_mode': ${tracking.GA_DEBUG_MODE},
                });
              `
            }}
          />
          {/* Google Maps — defer, only needed on address forms */}
          <script
            defer
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places`}
          />
          <script dangerouslySetInnerHTML={{ __html: FacebookPixelObject }} />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${tracking.FB_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </Head>
        <body>
          <style
            dangerouslySetInnerHTML={{
              __html: `
              html, body, #__next {
                min-height: 100vh;
                background: #050012;
                color: #fff;
              }
              #__next > div {
                min-height: 100vh;
              }
              /* Splash screen — small blurry blob + "LOADING", before React hydrates */
              #splash {
                position: fixed;
                inset: 0;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
                background: #050012;
                transition: opacity 0.6s ease-out;
              }
              #splash.hidden {
                opacity: 0;
                pointer-events: none;
              }
              #splash-blob {
                width: 112px;
                height: 112px;
                border-radius: 50%;
                background: radial-gradient(
                  circle at 36% 30%,
                  #efdcff 0%,
                  #b57bff 34%,
                  #d21f8f 72%,
                  #7c3aed 100%
                );
                filter: blur(11px);
                animation: splash-blob-morph 8s ease-in-out infinite,
                  splash-blob-hue 7s ease-in-out infinite;
                will-change: transform, border-radius, filter;
              }
              #splash .splash-label {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.42em;
                text-indent: 0.42em;
                color: rgba(255, 255, 255, 0.55);
                animation: splash-label-pulse 1.8s ease-in-out infinite;
              }
              @keyframes splash-blob-morph {
                0%   { border-radius: 46% 54% 60% 40% / 57% 44% 56% 43%; transform: scale(0.96) rotate(0deg); }
                25%  { border-radius: 63% 37% 42% 58% / 47% 63% 37% 53%; transform: scale(1.07) rotate(5deg); }
                50%  { border-radius: 39% 61% 56% 44% / 60% 41% 59% 40%; transform: scale(1)    rotate(-4deg); }
                75%  { border-radius: 56% 44% 36% 64% / 45% 59% 41% 55%; transform: scale(1.08) rotate(4deg); }
                100% { border-radius: 46% 54% 60% 40% / 57% 44% 56% 43%; transform: scale(0.96) rotate(0deg); }
              }
              @keyframes splash-blob-hue {
                0%, 100% { filter: blur(11px) hue-rotate(-6deg); }
                50%      { filter: blur(11px) hue-rotate(20deg); }
              }
              @keyframes splash-label-pulse {
                0%, 100% { opacity: 0.4; }
                50%      { opacity: 0.92; }
              }
              @media (prefers-reduced-motion: reduce) {
                #splash-blob, #splash .splash-label { animation: none; }
              }
            `
            }}
          />
          {/* Splash screen — small blurry gradient orb + label, pure CSS, no JS needed */}
          <div id="splash">
            <div id="splash-blob" aria-hidden="true" />
            <div className="splash-label">LOADING</div>
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `
            // Hide splash once React mounts
            if (typeof window !== 'undefined') {
              window.addEventListener('load', function() {
                setTimeout(function() {
                  var s = document.getElementById('splash');
                  if (s) { s.classList.add('hidden'); setTimeout(function() { s.remove(); }, 600); }
                }, 300);
              });
            }
          `
            }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
export default MyDocument;
