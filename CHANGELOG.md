# Changelog

## [0.3.0](https://github.com/algusaem/buycarmap/compare/buycarmap-v0.2.0...buycarmap-v0.3.0) (2026-10-02)


### Features

* adopt the core platform runtime (env, database, errors, logging, CSP) ([#51](https://github.com/algusaem/buycarmap/issues/51)) ([afe5f63](https://github.com/algusaem/buycarmap/commit/afe5f63bc675fbda50a86fd7a4f8e68d48c4111b)), closes [#47](https://github.com/algusaem/buycarmap/issues/47) [#48](https://github.com/algusaem/buycarmap/issues/48)
* move search to the server and adopt the core frontend stack ([#58](https://github.com/algusaem/buycarmap/issues/58)) ([5163eec](https://github.com/algusaem/buycarmap/commit/5163eec1924fc4fc0ac059003af627b88dca5452))


### Bug Fixes

* spawn prisma migrate deploy without the DEP0190 warning ([#54](https://github.com/algusaem/buycarmap/issues/54)) ([80c581e](https://github.com/algusaem/buycarmap/commit/80c581e0620673350a6aebbe2dd915e377d80ace))

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
