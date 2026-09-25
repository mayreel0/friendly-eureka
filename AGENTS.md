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
11. For every Gemini review finding, respond in the pull request with one of: incorporated, rebutted, or deferred. When a finding is incorporated, reply to the relevant GitHub review comment with the implementation details and the fixing commit. The user requests the actual Gemini re-review in Antigravity IDE; do not assume a separate Gemini GitHub bot, an automatic mention, or an automatic re-review request. Track separate follow-up work in Linear.
12. Never merge a pull request without the user's explicit approval.
