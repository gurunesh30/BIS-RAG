# Contributing

Thanks for helping improve BIS-RAG. Keep changes focused, explain the problem being solved, and include enough detail for another contributor to reproduce it.

## Local setup

Use Python 3.11 and Bun 1.3.14.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-test.txt

cd app/ui
bun install --frozen-lockfile
```

Run the checks from the repository root unless a command says otherwise.

```bash
python -m pytest -q

cd app/ui
bun run lint
bun run typecheck
bun run build
```

Use `requirements.txt` when you need the full application stack. `requirements-test.txt` is the smaller dependency set for the offline test suite.

## Pull requests

- Keep one topic per pull request.
- Describe the user-visible impact and any migration work.
- Add or update tests when behavior changes.
- Call out new environment variables and deployment requirements.
- Do not include API keys, credentials, private documents, or generated runtime data.

## Commit messages

The repository uses Conventional Commits:

```text
feat(rag): add query expansion
fix(api): handle empty uploads
docs(repo): clarify local setup
test(ui): cover citation rendering
chore(deps): update build tooling
```

Use the present tense and describe what changed. Avoid messages such as `updates` or `fix bug`.

## Reporting problems

Use the bug report issue form. Include the expected result, actual result, reproduction steps, and relevant logs. Remove secrets and personal data from logs before posting them.
