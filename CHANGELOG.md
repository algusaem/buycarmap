# Changelog

## [0.6.0](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.5.0...buycarmap-v0.6.0) (2026-10-21)


### Features

* **a11y:** add a skip link, keyboard walk-throughs, NVDA and WebKit checks ([#151](https://github.com/algusaem/buycarmap/issues/151)) ([ac93954](https://github.com/algusaem/buycarmap/commit/ac939549b562e7c38a4897c59283877c889f394a))
* **map:** add quick filters and split the desktop list and map ([#141](https://github.com/algusaem/buycarmap/issues/141)) ([174985d](https://github.com/algusaem/buycarmap/commit/174985df471fe238b3064103574f68d4309e8fc5))
* **map:** centre the map on your location within 50 km ([#153](https://github.com/algusaem/buycarmap/issues/153)) ([ef04c37](https://github.com/algusaem/buycarmap/commit/ef04c37c30c40bf346b72f9d625c015ca7cd6471))
* **map:** draw the design's own map style with MapLibre GL and OpenFreeMap ([#147](https://github.com/algusaem/buycarmap/issues/147)) ([f251597](https://github.com/algusaem/buycarmap/commit/f2515978376e00240ea9b505a0d05999bdbd7fd8))
* **ui:** give every control hover and press feedback and faster motion ([#144](https://github.com/algusaem/buycarmap/issues/144)) ([d558170](https://github.com/algusaem/buycarmap/commit/d55817004584a69e7b57291d09fd33f10f144327))


### Bug Fixes

* **alerts:** stop the alert runner from keeping the Neon compute awake ([#149](https://github.com/algusaem/buycarmap/issues/149)) ([24ab93d](https://github.com/algusaem/buycarmap/commit/24ab93dbf1f837348eea5754902edbc2dc9d1726))
* **legal:** jump to a section after the folded index leaves the page ([#139](https://github.com/algusaem/buycarmap/issues/139)) ([586c86a](https://github.com/algusaem/buycarmap/commit/586c86a2e95593b7c38fb5078b8860341891030b)), closes [#137](https://github.com/algusaem/buycarmap/issues/137)
* **map:** announce the result count and name the preview by its car ([#155](https://github.com/algusaem/buycarmap/issues/155)) ([361334b](https://github.com/algusaem/buycarmap/commit/361334b12a93c72ad1616ac3c3960b5d5e08f990))
* **map:** settle the phone results sheet from the finger's release point ([#148](https://github.com/algusaem/buycarmap/issues/148)) ([446998e](https://github.com/algusaem/buycarmap/commit/446998e45c10f001f3095bcb5d8f567b1714202c))
* **nav:** bring the tab bar back at the end of a page's scroll ([#145](https://github.com/algusaem/buycarmap/issues/145)) ([3005b3d](https://github.com/algusaem/buycarmap/commit/3005b3d7dd1cf04d04d4cf2309f8ef9e89eef92a))

## [0.5.0](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.4.0...buycarmap-v0.5.0) (2026-10-18)


### Features

* drag the phone map sheet and keep pages clear of browser toolbars ([#136](https://github.com/algusaem/buycarmap/issues/136)) ([e88f2c9](https://github.com/algusaem/buycarmap/commit/e88f2c9c6582c2c5d873f926f4fdfdadefd851e6)), closes [#133](https://github.com/algusaem/buycarmap/issues/133) [#126](https://github.com/algusaem/buycarmap/issues/126)
* redesign every page with the new BuyCarMap look ([#129](https://github.com/algusaem/buycarmap/issues/129)) ([8d84526](https://github.com/algusaem/buycarmap/commit/8d84526a9b99fba79e86c5c592ef04bb12c45951))

## [0.4.0](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.3.1...buycarmap-v0.4.0) (2026-10-11)


### Features

* **account:** let users download a copy of their data ([#108](https://github.com/algusaem/buycarmap/issues/108)) ([0ba57cc](https://github.com/algusaem/buycarmap/commit/0ba57ccd9b0df7f0d967bb028b67599f0d3c344a))


### Bug Fixes

* **alerts:** reclaim a poll job whose worker died ([#107](https://github.com/algusaem/buycarmap/issues/107)) ([99a3120](https://github.com/algusaem/buycarmap/commit/99a312049198f069f9b5514c00fe5aa193aa7d1d))
* **alerts:** retry a save that races another save of the same new criteria ([#106](https://github.com/algusaem/buycarmap/issues/106)) ([f47bbf7](https://github.com/algusaem/buycarmap/commit/f47bbf789dcca9679c74d6fb45567ea7f9ce898c))
* **db:** make related registration and alert writes atomic ([#97](https://github.com/algusaem/buycarmap/issues/97)) ([7200362](https://github.com/algusaem/buycarmap/commit/7200362554ebe3b53d9d7ed89f9bc3974e3b442e))
* **deps:** override vulnerable handlebars and source-map-js ([#104](https://github.com/algusaem/buycarmap/issues/104)) ([fe4bfad](https://github.com/algusaem/buycarmap/commit/fe4bfade51371b9529e12671290029851bf5bf1e))
* **i18n:** store the chosen language on the account when signed in ([#110](https://github.com/algusaem/buycarmap/issues/110)) ([28269b2](https://github.com/algusaem/buycarmap/commit/28269b20775dc778c53cdab769c5211f7ca34978))
* **privacy:** list every processor and state only what the app does ([#99](https://github.com/algusaem/buycarmap/issues/99)) ([f787e24](https://github.com/algusaem/buycarmap/commit/f787e2427a0af50ebb0f7ec26d437efe9de3529a))
* **search:** drop a next page that arrives after a newer search ([#91](https://github.com/algusaem/buycarmap/issues/91)) ([669a7d2](https://github.com/algusaem/buycarmap/commit/669a7d277871c3cdf4aa486f588811be7d5e63b6))
* **search:** rate-limit the car models action per IP ([#112](https://github.com/algusaem/buycarmap/issues/112)) ([2dca876](https://github.com/algusaem/buycarmap/commit/2dca8768c24204977dc9f2e7de7540c4a10a24de))
* **search:** search within 50 km when coordinates come without a radius ([#92](https://github.com/algusaem/buycarmap/issues/92)) ([afbba08](https://github.com/algusaem/buycarmap/commit/afbba08d605d996e2e3155d913f1bb423d947965))
* **ui:** honour prefers-reduced-motion across the app ([#115](https://github.com/algusaem/buycarmap/issues/115)) ([f66cae3](https://github.com/algusaem/buycarmap/commit/f66cae39dd6b591fefc0d9cb2c5e20db4b71d760))
* **wallapop:** fall back to the country centre like the other sources ([#111](https://github.com/algusaem/buycarmap/issues/111)) ([3e25e11](https://github.com/algusaem/buycarmap/commit/3e25e117e7d03d36d2eac9cd4249b922aaad4846)), closes [#30](https://github.com/algusaem/buycarmap/issues/30)

## [0.3.1](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.3.0...buycarmap-v0.3.1) (2026-10-09)


### Bug Fixes

* **account:** release alert criteria when an account is deleted ([#77](https://github.com/algusaem/buycarmap/issues/77)) ([845b2ac](https://github.com/algusaem/buycarmap/commit/845b2ac79d6556dc1f6ee490de3c786a2016db35))
* **alerts:** apply the map's radius and model filter to alert matches ([#78](https://github.com/algusaem/buycarmap/issues/78)) ([f962494](https://github.com/algusaem/buycarmap/commit/f962494afb34ab904fb9f2fead0a6a549cc5a857))
* **map:** keep the user's viewport when the next page loads ([#84](https://github.com/algusaem/buycarmap/issues/84)) ([029c2c3](https://github.com/algusaem/buycarmap/commit/029c2c34a7ea6045397567c353956378c919892d))
* **search:** treat a repeated Wallapop cursor as the end of Wallapop ([#76](https://github.com/algusaem/buycarmap/issues/76)) ([0f0fc52](https://github.com/algusaem/buycarmap/commit/0f0fc523b3540561ba0a0ead10957176b73c8251))

## [0.3.0](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.2.0...buycarmap-v0.3.0) (2026-10-08)


### Features

* adopt the core platform runtime (env, database, errors, logging, CSP) ([#51](https://github.com/algusaem/buycarmap/issues/51)) ([afe5f63](https://github.com/algusaem/buycarmap/commit/afe5f63bc675fbda50a86fd7a4f8e68d48c4111b)), closes [#47](https://github.com/algusaem/buycarmap/issues/47) [#48](https://github.com/algusaem/buycarmap/issues/48)
* give previews their own seed-only database and record EU regions ([#65](https://github.com/algusaem/buycarmap/issues/65)) ([52bd43f](https://github.com/algusaem/buycarmap/commit/52bd43f88039583ccd0425c9fa1d62b45766cb29))
* move authentication to Better Auth with Postgres sessions ([#63](https://github.com/algusaem/buycarmap/issues/63)) ([b0e2136](https://github.com/algusaem/buycarmap/commit/b0e2136f453edfcdb38910b215ba67df7a6f0084))
* move rate limiting to Upstash, alerts to QStash and email to react-email ([#61](https://github.com/algusaem/buycarmap/issues/61)) ([2d9b4f2](https://github.com/algusaem/buycarmap/commit/2d9b4f225ab58ea71fe380ad3a6264dc1f221488))
* move search to the server and adopt the core frontend stack ([#58](https://github.com/algusaem/buycarmap/issues/58)) ([5163eec](https://github.com/algusaem/buycarmap/commit/5163eec1924fc4fc0ac059003af627b88dca5452))


### Bug Fixes

* **deps:** update next, vitest and vulnerable transitive dependencies ([#66](https://github.com/algusaem/buycarmap/issues/66)) ([75f3f49](https://github.com/algusaem/buycarmap/commit/75f3f499730a3963bd50088bf7b0456455c6e232))
* **map:** show streets and labels on the map instead of a watermark ([#71](https://github.com/algusaem/buycarmap/issues/71)) ([5107a9e](https://github.com/algusaem/buycarmap/commit/5107a9e82321b2d43fd3074147196134e16c96cd))
* spawn prisma migrate deploy without the DEP0190 warning ([#54](https://github.com/algusaem/buycarmap/issues/54)) ([80c581e](https://github.com/algusaem/buycarmap/commit/80c581e0620673350a6aebbe2dd915e377d80ace))
* theme toasts from the tokens and drop the unseen sign-in toast ([#69](https://github.com/algusaem/buycarmap/issues/69)) ([a5436d0](https://github.com/algusaem/buycarmap/commit/a5436d09f30817031437e50aa9c9af1ef1fb100a))

## [0.2.0](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.1.0...buycarmap-v0.2.0) (2026-09-28)


### Features

* add car alerts with a queued background poller and email digests ([b470a68](https://github.com/algusaem/buycarmap/commit/b470a68408f4d45be646fd72eca1c2ea87ce1be5))
* add car model filter based on selected brand ([2b5dde6](https://github.com/algusaem/buycarmap/commit/2b5dde67f5879c410d89a6bdef774cfa2f748889))
* Add custom scrollbar styles for improved UI experience ([c308bf0](https://github.com/algusaem/buycarmap/commit/c308bf0ad0d07830b7824a8bb0107737db45b252))
* add expanding circle animation for theme switching ([fdff784](https://github.com/algusaem/buycarmap/commit/fdff784ece80b302d3dda54fe2347fe8594450bd))
* add location filter, map auto-fit, and clean up prop relay ([cf0a3bf](https://github.com/algusaem/buycarmap/commit/cf0a3bf965dad0b213034c8e260e7405bb55311e))
* add price, mileage, year, horsepower, and time filters to search ([e0b1d20](https://github.com/algusaem/buycarmap/commit/e0b1d20fbeedb13da3b35029a8f909630f9f2690))
* add search filters for fuel type, transmission, and brand ([5dea824](https://github.com/algusaem/buycarmap/commit/5dea8245cd4bad57be78ccffa46ef05e756642d0))
* add the Favorite model and its migration ([6adc12c](https://github.com/algusaem/buycarmap/commit/6adc12c22f53f826600ae4c44ee7db58e6f63f78))
* Add theme switcher and improve navbar/map styling ([a50e4c7](https://github.com/algusaem/buycarmap/commit/a50e4c79f45abb73b91cc736cd3d440b66a12b7f))
* add TOTP two-factor authentication with recovery codes ([aa817e9](https://github.com/algusaem/buycarmap/commit/aa817e9f107e23aef85a9085ba8eec293ab3ef12))
* adopt spec-driven and test-driven development across the app ([c32386e](https://github.com/algusaem/buycarmap/commit/c32386e737963b6f1adc1c2484edbd365c9c0a57))
* aggregate coches.net listings alongside Wallapop ([a2f5be0](https://github.com/algusaem/buycarmap/commit/a2f5be06564d7c12b2b558f927b9772622844cbe))
* aggregate milanuncios listings as a third source ([3d558bf](https://github.com/algusaem/buycarmap/commit/3d558bf006beabab5396d75ab9ee0aa472bf4931))
* brand the Google sign-in button and offer OAuth on the register page ([454284c](https://github.com/algusaem/buycarmap/commit/454284cb42f740612668f57daa600efccd2e6ad5))
* document the whole project and enforce docs alongside specs ([8746084](https://github.com/algusaem/buycarmap/commit/87460840476f813e3878bea42d66e565a9809d9d))
* enable scrollable backgrounds on auth pages and improve session-aware sign-in CTA ([17dc13f](https://github.com/algusaem/buycarmap/commit/17dc13fcd69b4b709e5a1cf39ddbaeb4bc130899))
* give each git branch its own Neon database ([a3b3635](https://github.com/algusaem/buycarmap/commit/a3b36351dd841ae8c0f604c67d23de06ff0d346c))
* harden authentication with verify-first signup, email flows, and OAuth ([3bba1d2](https://github.com/algusaem/buycarmap/commit/3bba1d2d581636bacad6cfc9b33d0177eedf3c85))
* Implement theme switching functionality with next-themes and add ThemeProvider component ([144a090](https://github.com/algusaem/buycarmap/commit/144a0903d016ae2842bc27daa0c657606e884810))
* integrate Wallapop API with live search, map markers, and i18n ([3698ab9](https://github.com/algusaem/buycarmap/commit/3698ab9273ff68d0d3aef786d7598364d15d6f63))
* restructure the navbar with a mobile menu and account dropdown ([ef2451b](https://github.com/algusaem/buycarmap/commit/ef2451b2ffdc7f62684de176972aa1b728b2ff64))
* update TODO list with new tasks and improvements ([6c23cff](https://github.com/algusaem/buycarmap/commit/6c23cffa47e9b7128df820178c6183a9d888ebfe))
* wire credential auth to the database ([dd70305](https://github.com/algusaem/buycarmap/commit/dd70305270199af81c072d0d03522abb5ac6c3d0))
* wire landing search to the map and add password-reset and legal pages ([f090810](https://github.com/algusaem/buycarmap/commit/f090810ef4c2c284117bd9ae4110f41589057ffa))


### Bug Fixes

* enforce the radius and model filters where the sources merge ([417491b](https://github.com/algusaem/buycarmap/commit/417491be00c8f60a5bf59da1951f23c28dcfe207))
* keep fetching when a page is filtered away entirely ([d096f3f](https://github.com/algusaem/buycarmap/commit/d096f3f60e5926a8911a1f9bed89e5862bf68d76))
* make the branch-database guard test independent of where it runs ([4b69cee](https://github.com/algusaem/buycarmap/commit/4b69cee60aae21b59fd053e5b847652f96733b5f))
* prevent Wallapop IP-based geo-filtering and debounce search ([4b06ab4](https://github.com/algusaem/buycarmap/commit/4b06ab4cc80695831be6f1fe0f5d13c74b1ef066))
* use browser geolocation to prevent Vercel IP-based geo-filtering ([e1c83ec](https://github.com/algusaem/buycarmap/commit/e1c83ec77fa5691f21240861866f670232c9617d))
