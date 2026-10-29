# Abhay Trading: direct market prices

This package replaces the embedded quote widgets with numeric prices in the website's original cards, scrolling ticker and table. It uses Mathieu2301/TradingView-API via @mathieuc/tradingview 4.1.0 for oil and forex, plus a SunSirs daily-price reader for China PTA and MEG.

## Run

Install Node.js 22.12 or newer. Extract this ZIP, open a terminal in Abhay-Live-Prices, then run:

```
npm ci
npm start
```

Open http://localhost:3000. Do not double-click public/index.html: it requires the server's /api/prices endpoint.

The `npm start` command automatically loads `.env` from the project folder when present. Copy `.env.example` to `.env` and set your private Google Apps Script URL and token there. `.env` is ignored and must never be committed or uploaded. On a hosting provider, set `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_APPS_SCRIPT_TOKEN` in its environment-variable settings instead; the host then supplies them each time the service starts.

## Updating from the previous ZIP

Stop the old server with Ctrl+C. Extract this ZIP to a new folder, open that folder in Command Prompt, run `npm ci`, then `npm start`. Open http://localhost:3000 and press Ctrl+F5. This update changes backend files and dependencies, so replacing only public/index.html is insufficient. Copy any of your own company/contact edits into the new public/index.html before using it publicly.

## China PTA and MEG (SunSirs)

- Same card and table positions; renamed China PTA — SunSirs and China MEG — SunSirs.
- Values are Chinese yuan (CNY/RMB) per metric tonne, not Indian rupees per kg. No currency conversion or Indian market estimate is performed.
- Source pages publish daily assessments. The server checks every 15 minutes when requested; that does not produce a new market price every 15 minutes.
- Source publication dates are preserved as date-only values. Three-day-old observations are additionally flagged by age.
- The initial fallback observations were verified from the SunSirs pages on 29 October 2026: PTA 7,299.25 (previous 7,228.50), MEG 5,766.67 (previous 5,733.33), all latest observations dated 28 October 2026.
- Fallbacks are explicitly marked last known / update unavailable until a successful source fetch. Successful values are cached in memory; after server restart the bundled dated fallbacks are used until another successful fetch.
- An earlier direct request returned a JavaScript security-check page. The final Node.js integration test successfully fetched both SunSirs pages: PTA publication date 2026-10-29, MEG publication date 2026-10-28, both with stale=false. If a future request is blocked, the reader detects the security check and does not attempt to bypass it; the date and last-known label remain visible. Source links allow manual checks. Availability can vary by host.
- The parser passed representative table-fixture tests and the server successfully parsed both actual source pages. If SunSirs changes its table, the adapter fails safely instead of inventing prices.

## Publish

Upload this entire project to a host that runs a persistent Node.js web service. Use `npm ci` as the build/install command and `npm start` as the start command. The server honors the host's PORT environment variable. Serve the website and API together on the same domain with HTTPS. A static-only host, including GitHub Pages, cannot run this backend. Your host must allow outbound secure WebSockets to data.tradingview.com and HTTPS to www.sunsirs.com.

## Website enquiries and Google Sheets

The enquiry form requires a 10-digit mobile number and submits to the Node server. The server forwards validated submissions to the deployed Google Apps Script, which appends them to the `Enquiries` sheet and emails `dme@abhaytrading.in`. The Apps Script URL defaults to the current deployment in `server.mjs`; you can override it with `GOOGLE_APPS_SCRIPT_URL`. Set `GOOGLE_APPS_SCRIPT_TOKEN` to the same private token stored as the Apps Script `WEBHOOK_TOKEN` script property. Never commit or expose this token in frontend code. Local `npm start` reads the ignored `.env` file; hosting providers must receive both variables in their environment settings. Without either setting, the form reports that the enquiry was not saved and preserves the entered values.

## Behavior

- Brent: TVC:UKOIL; WTI: TVC:USOIL; USD/INR: FX_IDC:USDINR; Cotton: ICEUS:CT1!.
- The page fetches immediately and every 15 minutes while active, and refreshes on returning to an overdue tab.
- Server requests share a cache and concurrent requests are combined. Successful quotes are cached for 15 minutes. After failures the cache permits retry after one minute; the page continues its 15-minute polling.
- Prices do not necessarily change each time; they depend on the provider and market hours.
- As-of time comes from the quote's lp_time, never the request time. Missing quote time is labeled.
- Missing initial TradingView prices show a dash; failed updates retain a clearly labeled last-known quote. SunSirs uses the dated fallbacks described above.
- The six displayed markets are Brent, WTI, ICE cotton futures, China PTA, China MEG (SunSirs), and USD/INR.
- This is an unofficial community API. Anonymous quotes can be delayed or substituted; TVC oil symbols are indicative references, not guaranteed exchange futures or executable prices. Public redistribution is subject to provider permissions.
- No login cookies or account credentials are included or required by this implementation.

## Verification

Run `npm test`. Offline tests cover invalid data, quote timestamps, caching, concurrent calls, partial failures and recovery. JavaScript syntax and package imports were checked. A real request for each symbol was attempted here, but failed because data.tradingview.com could not resolve (EAI_AGAIN). TradingView live quote retrieval must be verified on your deployed host. SunSirs retrieval was verified successfully through the actual /api/prices endpoint. Seven backend tests passed, and a frontend check verified the China labels, units, dates and stale states. This package has not been deployed.

Sources:
https://github.com/Mathieu2301/TradingView-API
https://github.com/Mathieu2301/TradingView-API/blob/main/docs/data-api.md

SunSirs sources:
https://www.sunsirs.com/uk/prodetail-356.html
https://www.sunsirs.com/uk/prodetail-222.html
https://www.sunsirs.com/uk/sdetail.html

## Timestamp display

Exact quote timestamps and the last-response timestamp use `29 Oct, 10:45 IST` (24-hour clock). Daily assessments and older snapshots without a source time use `28 Oct (time not provided)`; period-based snapshots retain both dates. No midnight or request time is substituted for an unknown quote time. This formatting-only update needs only `public/index.html` replaced, then a server restart and browser hard refresh.

## ICE cotton update

The Cotton row now requests ICEUS:CT1! through the existing TradingView adapter every 15 minutes. It is Cotton No. 2 continuous futures on ICE Futures U.S., quoted in US cents per pound; it is not an Indian domestic cotton rate. The row and ticker stay in their original positions. Missing quotes show a dash and last-known quotes are marked stale after failures. Quote timestamps keep the requested IST format.

Eight offline backend tests passed, including cotton requests and partial failure recovery. Direct cotton retrieval was attempted but TradingView DNS failed (EAI_AGAIN) in this environment. Actual source availability and delay must be checked on the running user host.


To apply this update: stop the old server; extract the new ZIP into a separate folder; run npm ci and npm start there; refresh the browser with Ctrl+F5. Backend and frontend files both changed. Preserve your own company/contact edits when moving to the new index.html.

Cotton source: https://www.tradingview.com/symbols/ICEUS-CT1!/

## Latest display update

The two unsupported price entries have been removed from the data list, previous values, table and ticker. The remaining six markets retain their original relative order, formatting and refresh behavior. For this removal-only update, replace public/index.html from this ZIP, restart the server, then hard-refresh the browser.


Godown slideshow: Home and Infrastructure use the three photos in public/images/. Photos advance automatically every 3 seconds. Slideshows run automatically without visible navigation controls. Keep the images folder when uploading or replacing the website, and restart the Node server after updating files.

Loading and dispatch: all Home and Infrastructure tiles now use dispatch-1.png, dispatch-2.png and dispatch-3.png from public/images, with automatic 3-second slides and no visible navigation controls.

Featured yarns: Polyester, Cotton and Blended yarn cards include short descriptions, enquiry links and three illustrative yarn-cone images per category, rotating every 3 seconds. These illustrations are not actual stock photographs.
