# Changelog

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
