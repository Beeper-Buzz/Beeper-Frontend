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
                width: 120px;
                height: 120px;
                filter: blur(12px);
                animation: splash-blob-breathe 4s ease-in-out infinite;
              }
              #splash .splash-label {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.4em;
                text-indent: 0.4em;
                color: rgba(255,255,255,0.55);
                animation: splash-label-pulse 1.6s ease-in-out infinite;
              }
              @keyframes splash-blob-breathe {
                0%, 100% { transform: scale(1); }
                50%      { transform: scale(1.08); }
              }
              @keyframes splash-label-pulse {
                0%, 100% { opacity: 0.45; }
                50%      { opacity: 1; }
              }
              @media (prefers-reduced-motion: reduce) {
                #splash-blob, #splash .splash-label { animation: none; }
              }
            `
            }}
          />
          {/* Splash screen — small morphing blob via SMIL, no JS needed */}
          <div
            id="splash"
            dangerouslySetInnerHTML={{
              __html: `
            <svg id="splash-blob" viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#7c3aed" stroke="#ff008a" stroke-width="10" d="M43.3,-69.7C51.1,-62.3,49,-41.9,53.7,-26.1C58.4,-10.4,69.9,0.6,68.8,10.1C67.8,19.6,54.4,27.5,43.4,34.4C32.4,41.2,24,46.9,14.5,50.1C5,53.4,-5.6,54,-19.9,55.4C-34.2,56.8,-52.3,58.9,-58.2,51C-64.1,43.1,-57.9,25.3,-58.1,9.7C-58.3,-6,-65,-19.4,-65,-34C-65,-48.6,-58.4,-64.5,-46.4,-70C-34.4,-75.6,-17.2,-70.8,0.3,-71.2C17.7,-71.6,35.5,-77.2,43.3,-69.7Z">
                <animate attributeName="d" dur="8s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.25;0.5;0.75;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1" values="M43.3,-69.7C51.1,-62.3,49,-41.9,53.7,-26.1C58.4,-10.4,69.9,0.6,68.8,10.1C67.8,19.6,54.4,27.5,43.4,34.4C32.4,41.2,24,46.9,14.5,50.1C5,53.4,-5.6,54,-19.9,55.4C-34.2,56.8,-52.3,58.9,-58.2,51C-64.1,43.1,-57.9,25.3,-58.1,9.7C-58.3,-6,-65,-19.4,-65,-34C-65,-48.6,-58.4,-64.5,-46.4,-70C-34.4,-75.6,-17.2,-70.8,0.3,-71.2C17.7,-71.6,35.5,-77.2,43.3,-69.7Z;M36.4,-58.3C45.7,-50.6,51,-38.1,58.4,-25.6C65.9,-13,75.5,-0.4,76.7,13.1C77.9,26.5,70.8,40.9,59.4,48.4C48.1,55.9,32.5,56.7,18.3,59.4C4.2,62.2,-8.5,67.1,-21.3,66.2C-34.1,65.3,-47.1,58.7,-58.1,48.8C-69.1,38.9,-78,25.7,-82.2,10.5C-86.5,-4.7,-85.9,-21.8,-77.9,-34C-69.8,-46.1,-54.3,-53.2,-40.1,-58.7C-25.8,-64.3,-12.9,-68.3,0.3,-68.7C13.5,-69.2,27,-66.1,36.4,-58.3Z;M29.3,-48.1C38.6,-39.7,47.3,-33.3,55.5,-23.9C63.8,-14.5,71.7,-2.2,71.7,10.7C71.6,23.5,63.5,36.9,52.2,44.7C41,52.5,26.6,54.8,12.4,59.1C-1.8,63.4,-15.8,69.7,-28.5,67.2C-41.3,64.6,-52.8,53.2,-62.2,40.1C-71.7,27,-79,12.2,-78.1,-1.8C-77.3,-15.8,-68.2,-29.1,-56.9,-38.1C-45.7,-47,-32.2,-51.6,-20.1,-58.2C-8,-64.7,2.6,-73.3,13.1,-72.5C23.5,-71.7,33.7,-61.5,29.3,-48.1Z;M38.9,-66C49.2,-56.4,55.7,-43.8,62.9,-30.9C70.1,-18,77.8,-4.9,77.2,7.8C76.6,20.5,67.5,32.9,56.8,42.2C46.1,51.5,33.7,57.8,20.5,62.4C7.4,67.1,-6.5,70.2,-20.4,68.9C-34.3,67.6,-48.3,61.8,-56.4,51.1C-64.5,40.3,-66.7,24.7,-69.9,8.8C-73.2,-7.1,-77.5,-23.3,-72.3,-36C-67.1,-48.8,-52.4,-58.1,-38,-65.8C-23.6,-73.5,-9.4,-79.5,3.1,-84.5C15.5,-89.4,28.6,-75.6,38.9,-66Z;M43.3,-69.7C51.1,-62.3,49,-41.9,53.7,-26.1C58.4,-10.4,69.9,0.6,68.8,10.1C67.8,19.6,54.4,27.5,43.4,34.4C32.4,41.2,24,46.9,14.5,50.1C5,53.4,-5.6,54,-19.9,55.4C-34.2,56.8,-52.3,58.9,-58.2,51C-64.1,43.1,-57.9,25.3,-58.1,9.7C-58.3,-6,-65,-19.4,-65,-34C-65,-48.6,-58.4,-64.5,-46.4,-70C-34.4,-75.6,-17.2,-70.8,0.3,-71.2C17.7,-71.6,35.5,-77.2,43.3,-69.7Z"/>
                <animate attributeName="fill" dur="8s" repeatCount="indefinite" values="#7c3aed;#ff008a;#7c3aed"/>
                <animate attributeName="stroke" dur="8s" repeatCount="indefinite" values="#ff008a;#7c3aed;#ff008a"/>
              </path>
            </svg>
            <div class="splash-label">LOADING</div>
          `
            }}
          />
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
