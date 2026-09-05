# Contributing to SWU OSR

First off, thank you for considering contributing to SWU OSR! Every contribution — big or small — helps make this platform better for the entire community.

## Table of Contents

- [Reporting Bugs & Feature Requests](#reporting-bugs--feature-requests)
- [Fork & Create a Branch](#fork--create-a-branch)
- [Commit Message Convention](#commit-message-convention)
- [Make a Pull Request](#make-a-pull-request)
- [Keeping Your Pull Request Updated](#keeping-your-pull-request-updated)
- [CI/CD & Automated Release](#cicd--automated-release)

---

## Reporting Bugs & Feature Requests

Check the [Issues](../../issues) page first to see if someone has already opened a ticket. If not, feel free to create one with a clear title and description.

---

## Fork & Create a Branch

If you want to fix a bug or implement a feature, fork the repo and create a descriptive branch from `main`.

```bash
# Example for issue #325
git checkout -b 325-add-new-feature
```

---

## Commit Message Convention

> ⚠️ **This project uses [Conventional Commits](https://www.conventionalcommits.org/).** Your commit messages directly determine the next version number — please follow this format carefully.

### Format

```
<type>(<scope>): <short description>
```

### Types & Their Effect on Versioning

| Type | Description | Version Bump |
|---|---|---|
| `feat` | A new feature | **Minor** `v1.0.0 → v1.1.0` |
| `fix` | A bug fix | **Patch** `v1.0.0 → v1.0.1` |
| `feat!` or `BREAKING CHANGE` | Breaking API/behavior change | **Major** `v1.0.0 → v2.0.0` |
| `chore` | Build process, tooling, dependency updates | No release |
| `docs` | Documentation changes only | No release |
| `refactor` | Code restructure without behavior change | No release |
| `test` | Adding or updating tests | No release |
| `style` | Code formatting, whitespace | No release |
| `perf` | Performance improvements | No release |
| `ci` | CI/CD configuration changes | No release |

### Examples

```bash
# New feature → minor bump
git commit -m "feat(auth): add OAuth2 login with Google"

# Bug fix → patch bump
git commit -m "fix(leaderboard): correct quarterly score calculation"

# Breaking change → major bump
git commit -m "feat!: redesign user profile API response structure"

# No release triggered
git commit -m "chore(deps): update Go dependencies to latest"
git commit -m "docs: update API endpoint documentation"
git commit -m "refactor(backend): extract skill service into separate module"
```

### Additional Rules

- Use **present tense** ("add feature" not "added feature")
- Use **imperative mood** ("move cursor to..." not "moves cursor to...")
- Keep the first line under **72 characters**
- Reference issues after the first line: `Closes #325`

---

## Make a Pull Request

Make sure your branch is up to date with the upstream `main` before opening a PR.

```bash
# Add upstream remote (only needed once)
git remote add upstream https://github.com/HMPSTI-SWU/SWU_OSR.git

# Sync with upstream main
git checkout main
git pull upstream main

# Rebase your feature branch
git checkout 325-add-new-feature
git rebase main
git push --set-upstream origin 325-add-new-feature
```

Then go to GitHub and open a Pull Request against `HMPSTI-SWU/SWU_OSR:main`.

---

## Keeping Your Pull Request Updated

If a maintainer asks you to "rebase" your PR, it means the `main` branch has moved forward. Run:

```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease
```

---

## CI/CD & Automated Release

This project uses a fully automated CI/CD pipeline. Here's what happens when your PR is merged:

```
PR merged to upstream/main
    ↓
CI (tests, lint, security scan)
    ↓
Semantic Release analyzes commit messages
    ↓
New version tag created (e.g. v1.2.3)
CHANGELOG.md updated automatically
GitHub Release published
    ↓
CD deploys the tagged version to VPS
```

### Key Points

- **Releases are automatic** — you don't need to manually tag or create releases.
- **Only conventional commits trigger a release** — `feat:` and `fix:` prefixes matter.
- **The release only runs on the upstream repo** (`HMPSTI-SWU/SWU_OSR`), not on forks.
- **CHANGELOG.md** is auto-generated and committed back to `main` after each release.
