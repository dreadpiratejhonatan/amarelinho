# Mobile / Cloud Agent → production

Edits made from the Cursor app on the phone (Cloud Agent) reach production without a manual merge — same pipeline as Neve Selvagem (`snow`).

## Pipeline

1. Agent opens a PR from a `cursor/*` branch.
2. Workflow **Auto-merge Cursor PRs**:
   - Retargets to `develop` if needed
   - Marks draft PRs ready
   - Waits for CI
   - Squash-merges into `develop`
   - Dispatches the existing deploy workflows
3. Production updates:
   - **HostGator** → https://jhonatanribeiro.com/amarelinho/  ← primary production
   - **GitHub Pages** → https://dreadpiratejhonatan.github.io/amarelinho/

## How to use from the phone

1. Open the Cursor app → Cloud Agents → repo **`dreadpiratejhonatan/amarelinho`**
2. Prompt in natural language (e.g. “aumenta a chuva”, “adiciona uma batida nova”)
3. Wait for the agent PR → auto-merge → Actions **Deploy HostGator**
4. Hard-refresh the site and check console: `[Amarelinho] build vXX`

## One-time GitHub Pages check

Environment **github-pages** must allow deploy from **`develop`** (and ideally **`main`**):

1. **Settings** → **Environments** → **github-pages**
2. Under **Deployment branches**, include **`develop`** (and **`main`** if you promote releases there)

HostGator production does **not** need this — it deploys from `develop` after each auto-merge / push.

## Notes

- Only branches named `cursor/…` are auto-merged.
- If CI fails, the PR stays open for fix-ups.
- Desktop pushes to `develop` still deploy via the normal push triggers.
- Merges with `GITHUB_TOKEN` do not re-trigger push workflows — deploys are kicked with `workflow_dispatch` after merge.
