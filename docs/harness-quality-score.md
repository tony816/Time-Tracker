# Harness Quality Score

Use this scorecard when reviewing whether the harness still covers the highest-risk work surfaces. Codex-readability means a future agent can identify the files to read, the tests to run, and the user-facing behavior being protected without reconstructing history from commits.

| Surface | Grade | Codex-readability criteria |
| --- | --- | --- |
| Planned editing / selection | A | Maps retap, merge selection, dropdown, and sheet behavior to focused controller tests. |
| Mobile segment resize | A | Names mobile viewport checks and resize repeatability criteria. |
| Persistence / sync | B | Identifies serialization and remote sparse snapshot tests. |
| Actual-lock legacy guard | A | Keeps plan-only and legacy actual-field removal checks visible. |
| Timer | B | Points to timer isolation and running-state controller coverage. |
