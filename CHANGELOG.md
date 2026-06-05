# Changelog

## [0.6.0](https://github.com/cvlhofrederic-art/fixit-production/compare/v0.5.0...v0.6.0) (2026-06-05)


### Features

* **btp:** acompte déjà émis marqué « déjà émis » mais ré-émissible ([#405](https://github.com/cvlhofrederic-art/fixit-production/issues/405)) ([41110c3](https://github.com/cvlhofrederic-art/fixit-production/commit/41110c39c0dbb691119d4268bfa9562e87e80f7b))


### Bug Fixes

* **security:** XSS SVG signatures + IDOR referral (les 2 vulns réelles de [#39](https://github.com/cvlhofrederic-art/fixit-production/issues/39)) ([#404](https://github.com/cvlhofrederic-art/fixit-production/issues/404)) ([01a150e](https://github.com/cvlhofrederic-art/fixit-production/commit/01a150eac41d2b6033c45c6107b786d02bbea902))

## [0.5.0](https://github.com/cvlhofrederic-art/fixit-production/compare/v0.4.0...v0.5.0) (2026-06-05)


### Features

* **btp:** « Facturer » propose facture totale ou facture d'acompte ([#403](https://github.com/cvlhofrederic-art/fixit-production/issues/403)) ([37eb480](https://github.com/cvlhofrederic-art/fixit-production/commit/37eb4801192a9b299dc9db6f92e4808a1494f2fa))
* **btp:** échéancier d'acomptes du devis repris sur la facture (1 clic) ([#400](https://github.com/cvlhofrederic-art/fixit-production/issues/400)) ([52f6d4c](https://github.com/cvlhofrederic-art/fixit-production/commit/52f6d4cf704929dbf54b90f1c73a46285b7b24b3))


### Bug Fixes

* **btp:** échéancier d'acomptes éditable uniquement sur le devis ([#402](https://github.com/cvlhofrederic-art/fixit-production/issues/402)) ([60751c4](https://github.com/cvlhofrederic-art/fixit-production/commit/60751c421bab9fdf0af75dee3374220dbe9fb80a))

## [0.4.0](https://github.com/cvlhofrederic-art/fixit-production/compare/v0.3.0...v0.4.0) (2026-06-05)


### Features

* **btp:** acompte émis en un clic (% manuel + chips 20/30/50) ([#399](https://github.com/cvlhofrederic-art/fixit-production/issues/399)) ([e657f18](https://github.com/cvlhofrederic-art/fixit-production/commit/e657f1826669594aeaa0640dc5b1d63419f60b5f))
* **legal:** FR-V6 — PA réception stub + legal_hold endpoint + dashboard étendu ([#130](https://github.com/cvlhofrederic-art/fixit-production/issues/130)) ([6ebd0f2](https://github.com/cvlhofrederic-art/fixit-production/commit/6ebd0f260a604a6dcf7ef2e8d78b318e49ea4929))


### Bug Fixes

* **a11y:** contraste WCAG 2 AA sur pages publiques (EAA 2025) ([#37](https://github.com/cvlhofrederic-art/fixit-production/issues/37)) ([662712c](https://github.com/cvlhofrederic-art/fixit-production/commit/662712c927acbfc40be699659ae09c35651c085d))
* **a11y:** violations Lighthouse sur /pt/mercados/publicar/ ([#150](https://github.com/cvlhofrederic-art/fixit-production/issues/150)) ([d36495a](https://github.com/cvlhofrederic-art/fixit-production/commit/d36495a11ccbc29e23b5cfe47f902a4393936d42))
* **auth:** trigger sync user_metadata.role -&gt; app_metadata.role ([#59](https://github.com/cvlhofrederic-art/fixit-production/issues/59)) ([5b3a48d](https://github.com/cvlhofrederic-art/fixit-production/commit/5b3a48dd50acd0b3cb0c8455f17643ad4334df6b))
* **btp:** acompte met à l'échelle tout le document (customTables incluses) ([#396](https://github.com/cvlhofrederic-art/fixit-production/issues/396)) ([7339ed2](https://github.com/cvlhofrederic-art/fixit-production/commit/7339ed235f265a5c3e706ca9dd5db06650f554ec))
* **btp:** avoir négative tout le document (customTables incluses) ([#398](https://github.com/cvlhofrederic-art/fixit-production/issues/398)) ([4e8cf64](https://github.com/cvlhofrederic-art/fixit-production/commit/4e8cf64e22d4ef4f77b5b46ef385e118277702c4))
* **ci:** fallback placeholder Supabase dans le middleware → répare le gate E2E (régression globale) ([#397](https://github.com/cvlhofrederic-art/fixit-production/issues/397)) ([063b07b](https://github.com/cvlhofrederic-art/fixit-production/commit/063b07b431b43b16ad1b7657ffe6fdfa9db208f3))
* **claude:** remove broken env interpolation in .mcp.json ([#83](https://github.com/cvlhofrederic-art/fixit-production/issues/83)) ([09369ca](https://github.com/cvlhofrederic-art/fixit-production/commit/09369ca3d60d41d52cd7fcb4b83ac9e6c7f35e36))
* **seo:** pro 2026 geo-redirect + hreflang x-default + LHCI ([#161](https://github.com/cvlhofrederic-art/fixit-production/issues/161)) ([b7d5a21](https://github.com/cvlhofrederic-art/fixit-production/commit/b7d5a219d5dbc7b26c58ddc0d3c0088c19128669))
* **shared:** hygiene — fige search_path sur 9 functions SECURITY INVOKER ([#210](https://github.com/cvlhofrederic-art/fixit-production/issues/210)) ([6c52684](https://github.com/cvlhofrederic-art/fixit-production/commit/6c526849d60c668daba1149f0c064b89c1463c6f))
* **shared:** récupération auto des ChunkLoadError (bundle périmé après déploiement) ([#394](https://github.com/cvlhofrederic-art/fixit-production/issues/394)) ([6fc83eb](https://github.com/cvlhofrederic-art/fixit-production/commit/6fc83ebbc6155693cf401037856382c87c4b0f1f))
* **shared:** sync devis/factures legacy (id horodaté non-UUID) ([#352](https://github.com/cvlhofrederic-art/fixit-production/issues/352)) ([0c44627](https://github.com/cvlhofrederic-art/fixit-production/commit/0c44627ac9a0d14b123d297fc1273d07bf4ded9d))
* **shared:** tri par distance pour le groupe catalogue quand "autour de moi" ([#149](https://github.com/cvlhofrederic-art/fixit-production/issues/149)) ([0903ff2](https://github.com/cvlhofrederic-art/fixit-production/commit/0903ff256aec57683d651ecce34af51cd0546c68))
* **syndic:** aligne tests d5/d14 (unit + e2e) sur le rework Phase 3 ([#379](https://github.com/cvlhofrederic-art/fixit-production/issues/379)) ([#395](https://github.com/cvlhofrederic-art/fixit-production/issues/395)) ([9b9913d](https://github.com/cvlhofrederic-art/fixit-production/commit/9b9913dd32e30ac4d6a1076082ede3a84cdb0113))

## [0.3.0](https://github.com/cvlhofrederic-art/fixit-production/compare/v0.2.0...v0.3.0) (2026-06-04)


### Features

* **syndic:** CadernetaMan — « Export PDF » fonctionnel (générateur partagé) ([#389](https://github.com/cvlhofrederic-art/fixit-production/issues/389)) ([12d5671](https://github.com/cvlhofrederic-art/fixit-production/commit/12d5671f7cd6ac60e575197e1e40e0a758628e07))
* **syndic:** démo — exports CSV réels + DashCond KPIs live ([#388](https://github.com/cvlhofrederic-art/fixit-production/issues/388)) ([c38c28a](https://github.com/cvlhofrederic-art/fixit-production/commit/c38c28a28cb3af8d190d922642e46a7dbbabc816))
* **syndic:** générateur PDF rapports v54 + bouton « Descarregar PDF » fonctionnel ([#386](https://github.com/cvlhofrederic-art/fixit-production/issues/386)) ([2614a3c](https://github.com/cvlhofrederic-art/fixit-production/commit/2614a3cbad13c694cf1670b65fbec60c54b26062))
* **syndic:** Phase 3 — ModCobrAuto suivi des impayés réels (table syndic_impayes) ([#376](https://github.com/cvlhofrederic-art/fixit-production/issues/376)) ([05b7e2d](https://github.com/cvlhofrederic-art/fixit-production/commit/05b7e2d84c51f09c2075e00c508438b9874a77f0))
* **syndic:** Phase 3 — ModCobrJud pipeline réel de recouvrement (table syndic_recouvrement) ([#378](https://github.com/cvlhofrederic-art/fixit-production/issues/378)) ([cf24c40](https://github.com/cvlhofrederic-art/fixit-production/commit/cf24c40f4572d7ef2e88db1496abd330505b6dd2))
* **syndic:** Phase 3 — ModContabTec suivi des interventions calculé (lecture seule) ([#381](https://github.com/cvlhofrederic-art/fixit-production/issues/381)) ([2825792](https://github.com/cvlhofrederic-art/fixit-production/commit/28257925af6dec96c74eb52ea8ebe3832b45ad3d))
* **syndic:** Phase 3 — ModFaturacao factures condomínio réelles (table syndic_factures_copro) ([#379](https://github.com/cvlhofrederic-art/fixit-production/issues/379)) ([dbe1d3f](https://github.com/cvlhofrederic-art/fixit-production/commit/dbe1d3f49f5ebe884c0e059f3335a3a74b23c338))
* **syndic:** Phase 3 — ModHistEdificio vue consolidée par édifice (lecture seule) ([#383](https://github.com/cvlhofrederic-art/fixit-production/issues/383)) ([8aaeba1](https://github.com/cvlhofrederic-art/fixit-production/commit/8aaeba164244d5bad12dcdf24042e89fbee2a353))
* **syndic:** Phase 3 — ModMapaFiscal rapport fiscal calculé (lecture seule) ([#380](https://github.com/cvlhofrederic-art/fixit-production/issues/380)) ([8a7a33d](https://github.com/cvlhofrederic-art/fixit-production/commit/8a7a33dd1d64d392896023e8816a52eda93d9012))
* **syndic:** Phase 3 — ModRelatorioMensal aperçu calculé par mois (lecture seule) ([#385](https://github.com/cvlhofrederic-art/fixit-production/issues/385)) ([bc92e84](https://github.com/cvlhofrederic-art/fixit-production/commit/bc92e84b8c6f2d87384d7779a195104f2fc9c1d7))
* **syndic:** Phase 3 — ModRelGestao agrégats réels pré-remplis (lecture seule) ([#384](https://github.com/cvlhofrederic-art/fixit-production/issues/384)) ([28d8898](https://github.com/cvlhofrederic-art/fixit-production/commit/28d8898230da045215a2401ebdf995ac3c471ca5))
* **syndic:** Phase 3 — ModUrgencias urgences actives calculées (lecture seule) ([#382](https://github.com/cvlhofrederic-art/fixit-production/issues/382)) ([30508d0](https://github.com/cvlhofrederic-art/fixit-production/commit/30508d0a39f954d2eeef34cf1cc0649d9a5169f6))
* **syndic:** RelGestao — bouton « Descarregar PDF » fonctionnel (générateur partagé) ([#387](https://github.com/cvlhofrederic-art/fixit-production/issues/387)) ([5b34ebe](https://github.com/cvlhofrederic-art/fixit-production/commit/5b34ebe8c7ac45961be72b42bcbc7bf8c0e536ba))


### Bug Fixes

* **syndic:** pdf-lib en import dynamique → Worker Cloudflare sous 10 MiB ([#390](https://github.com/cvlhofrederic-art/fixit-production/issues/390)) ([117f29e](https://github.com/cvlhofrederic-art/fixit-production/commit/117f29efe2ce62854deca639741dc7ea7b79a38d))
* **syndic:** toast « em desenvolvimento » sur les boutons PDF/email inactifs (sécurité démo) ([#392](https://github.com/cvlhofrederic-art/fixit-production/issues/392)) ([7737d7c](https://github.com/cvlhofrederic-art/fixit-production/commit/7737d7c68ee7a4cd9586ca3734c08572bc403caa))


### Reverts

* **syndic:** retire la génération PDF (pdf-lib) — déploiement Worker &gt; 10 MiB ([#391](https://github.com/cvlhofrederic-art/fixit-production/issues/391)) ([89d1f7a](https://github.com/cvlhofrederic-art/fixit-production/commit/89d1f7a69b8fc11bc167d049929218f68e231bd4))

## [0.2.0](https://github.com/cvlhofrederic-art/fixit-production/compare/v0.1.0...v0.2.0) (2026-06-04)


### Features

* **syndic:** Phase 3 lot IA — ModAnaliseOrc analyse de texte câblée à l'agent Léa ([#373](https://github.com/cvlhofrederic-art/fixit-production/issues/373)) ([f7504bc](https://github.com/cvlhofrederic-art/fixit-production/commit/f7504bc3d05e2bd4b0d03643a1727f9623984a93))
* **syndic:** Phase 3 lot IA — ModAtasIA génération d'ata câblée à l'agent Alfredo ([#375](https://github.com/cvlhofrederic-art/fixit-production/issues/375)) ([0a95cd3](https://github.com/cvlhofrederic-art/fixit-production/commit/0a95cd317bab941cdefa499e7fb2795f845f0fe7))
* **syndic:** Phase 3 lot IA — ModOrcIA générateur câblé à l'agent Léa (lea-comptable) ([#370](https://github.com/cvlhofrederic-art/fixit-production/issues/370)) ([23f70b9](https://github.com/cvlhofrederic-art/fixit-production/commit/23f70b9e9cb7776d05fcc1437b9fe6ba9859bcaf))
* **syndic:** Phase 3 slice 16 — backend AG Digitais (route v54 sur syndic_assemblees existante) ([#366](https://github.com/cvlhofrederic-art/fixit-production/issues/366)) ([5de3eab](https://github.com/cvlhofrederic-art/fixit-production/commit/5de3eab6d21b1dac47fdf4f7c4950e1bbd7b3151))
* **syndic:** Phase 3 slice 17 — ModObrigPrazos réutilise la table syndic_prazos ([#367](https://github.com/cvlhofrederic-art/fixit-production/issues/367)) ([69a6c0a](https://github.com/cvlhofrederic-art/fixit-production/commit/69a6c0a77cba2622069bb012fc6ec6e5faa03185))
* **syndic:** Phase 3 slice 18 — ModSeguroObr réutilise syndic_seguros + syndic_sinistros ([#368](https://github.com/cvlhofrederic-art/fixit-production/issues/368)) ([6963324](https://github.com/cvlhofrederic-art/fixit-production/commit/6963324ab35e2715d0107d6971ce52db4c77d7bc))
* **syndic:** Phase 3 slice 19 — backend Contabilidade Condomínio (4 tables + route consolidée + UI) ([#369](https://github.com/cvlhofrederic-art/fixit-production/issues/369)) ([e7846ab](https://github.com/cvlhofrederic-art/fixit-production/commit/e7846ab50ac943f2c028c0cee64a6e6119bdf412))


### Bug Fixes

* **artisan:** adresse d'intervention longue passe à la ligne (PDF devis V2) ([e4ed2de](https://github.com/cvlhofrederic-art/fixit-production/commit/e4ed2dec1d8a674db1f5fe105bd610e9fa88eee3))
