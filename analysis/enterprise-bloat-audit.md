# Enterprise Bloat Audit

The remaining utility modules have been rewritten to match the lean scope requested in the PR review. The previously noted "enterprise" boilerplate has been replaced with concise TypeScript that documents only the behaviour we ship, keeps the existing processors and validators intact, and avoids unused observability hooks.

* `src/utils/content-sanitization-pipeline.ts` now exports a focused pipeline with the same processors, simple options, and without the former marketing copy. 【F:src/utils/content-sanitization-pipeline.ts†L1-L400】
* `src/utils/text-normalization-engine.ts` keeps the normalisation workflow but documents it with short inline comments instead of multi-page feature matrices. 【F:src/utils/text-normalization-engine.ts†L1-L218】
* `src/utils/text-encoding-utils.ts` exposes the same helpers with pragmatic option and result types, removing enterprise jargon while retaining error handling. 【F:src/utils/text-encoding-utils.ts†L1-L215】
* `src/utils/content-preservation-validator.ts` still provides the validator used in tests yet is now described and structured for the plugin's needs only. 【F:src/utils/content-preservation-validator.ts†L1-L278】

No further audit items are outstanding.
