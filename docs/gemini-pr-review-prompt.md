# Gemini Pull Request Review Prompt

## Usage

- When pasting this prompt into Antigravity, also paste the contents of `docs/review-criteria.md`.
- For a re-review, also paste the previous review findings.
- If Gemini made the fix, perform the re-review in a new session without the fix context and give that session the previous findings.

## Prompt

Review the supplied pull request in Korean.

Apply the review criteria in `docs/review-criteria.md`.

Do not rely only on the pull request summary or diff description. Inspect the supplied source, callers, and tests when they are available.

Report only actionable findings. For each finding, provide:

- Exact file and line
- Root cause
- Actual impact
- Severity
- Concrete remediation
- A Markdown diff when it would clarify the change

Distinguish confirmed defects, potential risks, and behavior that has not been verified at runtime.

If previous review findings are supplied, evaluate each finding's resolution and check whether the fix introduced new problems. If previous findings are not supplied, do not guess whether earlier findings were resolved.

Do not modify code or merge the pull request while reviewing it.
