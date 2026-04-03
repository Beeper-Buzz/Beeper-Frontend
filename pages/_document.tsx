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
              /* Splash screen — visible before React hydrates */
              #splash {
                position: fixed;
                inset: 0;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #050012;
                transition: opacity 0.6s ease-out;
              }
              #splash.hidden {
                opacity: 0;
                pointer-events: none;
              }
              #splash svg {
                width: 160px;
                height: 160px;
              }
              #splash .blob {
                fill: url(#splash-grad);
                filter: drop-shadow(0 0 30px rgba(124,58,237,0.5)) drop-shadow(0 0 12px rgba(255,0,138,0.4));
                transform-origin: center;
                animation: splash-morph 4s ease-in-out infinite, splash-pulse 2s ease-in-out infinite;
              }
              @keyframes splash-morph {
                0%, 100% { d: path("M43.3,-69.7C51.1,-62.3,49,-41.9,53.7,-26.1C58.4,-10.4,69.9,0.6,68.8,10.1C67.8,19.6,54.4,27.5,43.4,34.4C32.4,41.2,24,46.9,14.5,50.1C5,53.4,-5.6,54,-19.9,55.4C-34.2,56.8,-52.3,58.9,-58.2,51C-64.1,43.1,-57.9,25.3,-58.1,9.7C-58.3,-6,-65,-19.4,-65,-34C-65,-48.6,-58.4,-64.5,-46.4,-70C-34.4,-75.6,-17.2,-70.8,0.3,-71.2C17.7,-71.6,35.5,-77.2,43.3,-69.7Z"); }
                50% { d: path("M40.8,-63.9C54.3,-54.8,67.7,-45.9,76.2,-33.1C84.6,-20.3,88.1,-3.6,82,9C75.9,21.6,60.1,30,48.3,39.5C36.4,49,28.5,59.6,18.1,63.3C7.8,67,-5,63.9,-19.6,61.8C-34.1,59.7,-50.3,58.7,-59.9,50.4C-69.5,42.1,-72.5,26.5,-73.4,11.4C-74.3,-3.7,-73.2,-18.3,-65.9,-28.3C-58.6,-38.3,-45.1,-43.8,-33.1,-53.6C-21.1,-63.4,-10.5,-77.5,1.6,-80C13.7,-82.4,27.3,-73.1,40.8,-63.9Z"); }
              }
              @keyframes splash-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              #splash .splash-text {
                position: absolute;
                font-family: 'IBM Plex Mono', monospace;
                font-size: 7px;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.6);
                margin-top: 190px;
              }
            `
            }}
          />
          {/* Splash screen — pure HTML/CSS, no JS needed, fades on hydration */}
          <div id="splash">
            <svg viewBox="-100 -100 200 200">
              <defs>
                <linearGradient id="splash-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="50%" stopColor="#ff008a" />
                  <stop offset="100%" stopColor="#00ffff" />
                </linearGradient>
              </defs>
              <path className="blob" d="M43.3,-69.7C51.1,-62.3,49,-41.9,53.7,-26.1C58.4,-10.4,69.9,0.6,68.8,10.1C67.8,19.6,54.4,27.5,43.4,34.4C32.4,41.2,24,46.9,14.5,50.1C5,53.4,-5.6,54,-19.9,55.4C-34.2,56.8,-52.3,58.9,-58.2,51C-64.1,43.1,-57.9,25.3,-58.1,9.7C-58.3,-6,-65,-19.4,-65,-34C-65,-48.6,-58.4,-64.5,-46.4,-70C-34.4,-75.6,-17.2,-70.8,0.3,-71.2C17.7,-71.6,35.5,-77.2,43.3,-69.7Z" />
            </svg>
            <span className="splash-text">play with music</span>
          </div>
          <script dangerouslySetInnerHTML={{ __html: `
            // Hide splash once React mounts
            if (typeof window !== 'undefined') {
              window.addEventListener('load', function() {
                setTimeout(function() {
                  var s = document.getElementById('splash');
                  if (s) { s.classList.add('hidden'); setTimeout(function() { s.remove(); }, 600); }
                }, 300);
              });
            }
          ` }} />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
export default MyDocument;
