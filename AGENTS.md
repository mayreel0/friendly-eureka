<!-- project-wiki-mode:start -->
# Agent Instructions

## Project Wiki Mode

When the user says "위키 모드", "Project Wiki Mode", or asks to work on this project with wiki documentation, follow these rules.

### Work Root

Do actual implementation, debugging, testing, and command execution in this repository, meaning the directory that contains this `AGENTS.md` file.

Do not create project wiki documents inside this repository unless the user explicitly asks.

### Required Environment

Before writing wiki documents, confirm that this environment variable is set:

`OBSIDIAN_VAULT_DIR`

It must point to the local Obsidian Vault root. If it is missing, ask the user for the vault location before writing wiki documents.

### Wiki Root

Store project wiki documents in the Obsidian Vault:

`${OBSIDIAN_VAULT_DIR}/10-Projects/Lechigo`

If the folder does not exist, create it.

### Shared Rules

Follow the shared Project Wiki Mode rules:

`${OBSIDIAN_VAULT_DIR}/10-Projects/LLM Markdown Wiki System/08 Project Wiki Mode.md`

### During Work

- Solve the user's actual task first.
- Record important decisions and failures in `90 Logs/`.
- Promote stable setup and operation commands to `03 Operations Runbook.md`.
- Promote failures and fixes to `04 Troubleshooting.md`.
- Promote reusable concepts to `05 Knowledge Map.md`.
- Do not spend excessive time polishing wiki docs during active implementation.

### After Work

Before calling the task complete, update the project wiki with:

- What changed
- How it was verified
- Important decisions
- New operations commands
- Troubleshooting notes
- Reusable knowledge

### Public Documents

Only add this frontmatter to documents that are safe to publish:

```md
---
visibility: public
---
```

Never include real sensitive values in public documents.

Do not expose real domains, internal IPs, usernames, hostnames, SSH ports, Device IDs, tokens, cookies, API keys, private repository URLs, local home paths, or raw secrets.

Use placeholders such as `example.com`, `192.0.2.10`, `user`, `/path/to/project`, and `private repository`.

### If Unsure

If unsure where to store wiki documents, ask before writing.

Do not default to writing wiki documents into the current repository.
<!-- project-wiki-mode:end -->

## Linear and GitHub Development Operations

Follow these rules for development work on this repository:

1. Before starting development work, use the Linear MCP to search the `friendly-eureka` project for an existing related issue. Create a new issue only when no relevant issue exists; do not create duplicates.
2. Create new issues in the `Development` team and the `friendly-eureka` project. Use the issue ID actually assigned by Linear; never invent an issue ID.
3. When implementation begins, move the related issue to `In Progress`.
4. Preserve the existing Conventional Commits style for commit messages and development branches:
   - Commit: `<type>: <description>`
   - Branch: `<type>/<issue-id>-<short-description>`
   - Pull request: `<type>: <issue-id> <description>`
   - Include the issue ID in every branch name and pull request title. Do not require the issue ID in every commit message.
5. After a pull request is created, the GitHub integration automatically moves the issue to `In Review`. Do not duplicate that transition manually.
6. After a pull request is merged, the GitHub integration moves the issue to `Done`. Do not move an issue to `Done` merely because implementation is complete.
7. When a user decision genuinely blocks the work, move the issue to `Needs User` and collect the outstanding decisions into one focused request. Continue any work that can proceed independently.
8. When a separate problem is discovered, search for an existing related issue first and create a new issue only when necessary.
9. Include `Fixes <issue-id>` in the pull request body. Also distinguish verification actually performed from checks still required after deployment. Never report an unperformed test as passing.
10. For security changes, document the risk being addressed, the scope of the change, remaining limitations, and compensating defenses.
11. Follow the Review Feedback Response Rules below for every Gemini or other review finding.
12. Never merge a pull request without the user's explicit approval.

## Pull Request Review Workflow

Follow this workflow when reviewing a pull request:

1. Use the Linear MCP to identify and inspect the Linear issue linked to the pull request.
2. Use `gh` to inspect the pull request body, complete diff, existing reviews and comments, and CI results.
3. Do not rely only on the pull request summary. Inspect the relevant source, callers, and tests.
4. Apply the eight review criteria defined in `docs/review-criteria.md`.
5. Report only actionable findings and identify the exact file and line whenever the finding belongs to changed code.
6. Distinguish confirmed defects, potential risks, and behavior that has not been verified at runtime.
7. When re-reviewing fix commits, check whether every previous finding was resolved and whether the fix introduced new problems. Record the result on the pull request and follow the independent re-review requirements in the Review Feedback Response Rules.
8. Publish the result according to the GitHub Review Publishing Rules below and avoid duplicating existing review findings.
9. Do not modify code or merge the pull request while performing a code review.
10. Keep the Linear issue in `In Review` until the pull request is merged. Leave completion to the GitHub integration.
11. Write reviews in Korean.

## GitHub Review Publishing Rules

Follow these rules when publishing code reviews on GitHub pull requests:

1. Write a separate inline review comment on the specific file and line for each independent issue discovered in the changed code.
2. Inline comments must clearly state the root cause, actual impact, severity, and concrete remediation steps. Provide a code modification example using Markdown diff when appropriate.
3. When multiple new findings exist, submit only those new findings in a single batch review using the GitHub REST API (`POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`) with the `comments` array. Use `event: "COMMENT"`, set `commit_id` to the current pull request head SHA, and set `side: "RIGHT"` on every inline comment. Do not replace the batch with a list in the body of `gh pr review --comment`. `COMMENT` is known to work when the reviewer and pull request author are the same account; rejection of `APPROVE` or `REQUEST_CHANGES` in that situation has not been directly verified.
4. In the top-level PR review summary body, include only the review summary, major risks, and items requiring additional verification.
5. Record issues in pre-existing code outside the changed diff, or overarching architectural/operational concerns, separately in the top-level PR review summary. Never force-link unrelated concerns to arbitrary code lines.
6. Do not post duplicate inline comments for issues that share the same root cause.
7. After submission, verify via GitHub API that the inline comments were actually created on the intended lines. If a response has a null `line` field, confirm that the final line of each comment's `diff_hunk` is the intended target line.
8. During a re-review, reply to every existing inline thread through `POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`. Do not create a replacement thread or include the reply in a batch review. If a re-review finds both existing-thread results and new findings, reply to the existing threads individually and include only the new findings in the batch review.

## Review Feedback Response Rules

Follow these rules when responding as the pull request author:

1. Classify every finding as incorporated, rebutted, or deferred:
   - Incorporated: describe the change and identify the fixing commit SHA.
   - Rebutted: explain the conclusion using code or test evidence.
   - Deferred: explain why it is deferred and identify the follow-up Linear issue.
2. If the finding has a GitHub review thread, reply directly in that thread. If no thread exists, such as for Gemini feedback received only through Antigravity, publish one pull request comment that records the classification, response, and fixing commit SHA for each finding.
3. After incorporating feedback, request a re-review. A response alone does not establish that the finding has been resolved. The user requests Gemini re-reviews in Antigravity IDE; do not assume a Gemini GitHub bot, automatic mention, or automatic re-review request.
4. The agent or session that made a fix must not make the final judgment that its own fix resolves a finding. Any other reviewer may make that judgment: a different agent, a person, or a new session without the fix context that is given the previous findings.
5. Reviewer roles are not fixed and may change between review rounds.
6. Every re-review record on the pull request must state who made the fix and who performed the re-review, for example: `수정: Gemini / 재검토: Claude`.
7. When review feedback identifies a separate problem, search existing Linear issues before creating a follow-up issue and do not create duplicates.
