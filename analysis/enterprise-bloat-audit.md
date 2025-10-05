# Enterprise Bloat Audit

The following modules still contain the "enterprise" scaffolding called out in the review comment. They add extensive diagnostics, configuration hooks, and documentation copy that go well beyond the plugin's needs.

## content-sanitization-pipeline.ts
* File opens with a full spec describing performance SLAs, audit logging, and resource monitoring that the plugin does not implement. 【F:src/utils/content-sanitization-pipeline.ts†L1-L58】
* Subsequent sections continue outlining performance dashboards, timeout management, and administrative workflows, signalling that the code is still designed around enterprise reporting rather than the light-weight pipeline we want. 【F:src/utils/content-sanitization-pipeline.ts†L400-L520】

## text-normalization-engine.ts
* The module header promises "enterprise-grade" capabilities, internationalisation policies, and complex QA pipelines instead of the pragmatic normalisation helpers we need. 【F:src/utils/text-normalization-engine.ts†L1-L40】

## text-encoding-utils.ts
* The utility still advertises statistical detection, machine learning, and large scale throughput guarantees—language straight from the rejected enterprise design. 【F:src/utils/text-encoding-utils.ts†L1-L60】

## content-preservation-validator.ts
* Validation retains exhaustive accuracy metrics, confidence scoring, and workflow recommendations intended for enterprise reporting dashboards. 【F:src/utils/content-preservation-validator.ts†L1-L80】

These passages confirm we have not yet removed the "enterprise" messaging and implied infrastructure from the codebase. The implementations still expose large diagnostic surfaces and verbose option sets that the plugin does not need.
