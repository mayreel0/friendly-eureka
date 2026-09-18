---
title: Inspect and retain Android route recordings
date: 2026-09-19
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

## Goal

Let merchants inspect the actual walked shape before import and retrieve the original recording afterward. Continue R5/R6 without treating session-relative coordinates as calibrated guest AR anchors.

## Units

- U1 (separate PR): entrance-relative top-down path preview, numbered landmarks linked to the instruction list, equal axis scale, responsive layout and a height-range summary. Keep the existing draft-only import and confirmation behavior. Cover heading rotation, degenerate/vertical paths, browser file selection and mobile/desktop rendering.
- U2 (separate PR): retain the validated original recording alongside import provenance, survive restart and ordinary direction edits, provide original JSON download, reject forged replacement through ordinary state updates, preserve activation/version gates. Old metadata-only states remain readable. Reuse U1's preview for the saved original and explicitly distinguish it from later direction edits.

## Boundaries

No new recorder schema, GPS alignment, automatic floor classification, guest AR replay, public geometry endpoint, or automatic route activation. Use existing Lit, parser, state store and browser tests. Persist only parser-normalized recording fields, with existing import size/sample bounds.

## Verification

Test missing behavior first; run scoped tests followed by typecheck, format and affected browser flows. Inspect screenshots at 390px and 1280px. Review state replacement/conflict paths and keep original data inaccessible through guest APIs. Open one PR per unit; never auto-merge.
