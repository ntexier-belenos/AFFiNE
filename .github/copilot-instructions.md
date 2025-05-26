# GitHub Copilot Custom Instructions for AFFiNE (ntexier-belenos fork)

## 📌 Repository Scope

You are working on a **fork** of the official AFFiNE repository:
[https://github.com/ntexier-belenos/AFFiNE/](https://github.com/ntexier-belenos/AFFiNE/)

All code interactions (commits, issues, branches, tests, etc.) are performed **exclusively in this fork**, except for upstream synchronization and **pull requests**, which may be opened against the original AFFiNE repository when appropriate.

---

## 🧭 Development Workflow

### 🗂 Issue Management

- **Use GitHub Issues** in this repo to track work.
- Each issue should describe:

  - The feature, bugfix, or improvement
  - A plan of action
  - A section for documenting the implementation, encountered problems, and proposed solutions

- All development work must reference an existing issue.

### 🔀 Branch & Commit Strategy

- Create one branch per feature/fix, named: `feature/<short-description>` or `fix/<short-description>`
- Use clear and atomic commits. Each commit should serve a specific purpose.
- **Exclude commits related to `.devcontainer/` or development environment from pull requests**. Squash or rebase them out.
- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), e.g.:

  - `feat: add new export feature for PDF`
  - `fix: resolve editor crash on empty block`
  - `docs: improve README for local setup`
  - `test: add e2e test for block rendering`

### 🚀 Pull Requests

- Pull requests should be:

  - Tied to an issue (mention it in the PR description)
  - Self-contained and well-tested
  - Reviewed internally before merging

- PRs must include:

  - A summary of the changes
  - Screenshots or video of any UI/UX updates
  - Testing strategy/results
  - Known limitations or TODOs

- PRs may be opened against the original AFFiNE repository only for syncing or contributing improvements upstream.

---

## 📒 Code & Documentation Guidelines

### 🧑‍💻 Code Style

- Follow the existing code structure and naming conventions of AFFiNE
- Prefer readability over premature optimization
- Avoid magic values; use constants or config files

### 📦 Import Guidelines

- **Always use public package exports**: Import from `@blocksuite/package-name` or `@blocksuite/package-name/exported-path`
- **Never import from `/src` paths**: Avoid imports like `../../../data-view/src/...`
- **Use proper module boundaries**: Respect package architecture and don't bypass intended APIs
- **Avoid circular dependencies**: Never import from a public package export within the same package's internal modules
- **Example of correct imports**:

  ```typescript
  // ✅ Correct - using public exports from external packages
  import { initializeAllIds } from '@blocksuite/data-view/property-presets';
  import { PropertyConfig } from '@blocksuite/data-view';

  // ✅ Correct - using direct imports within the same package
  import { initializeAllIds } from '../../property-presets/id/generator.js';

  // ❌ Incorrect - importing from src paths
  import { initializeAllIds } from '../../../data-view/src/property-presets/id/generator';

  // ❌ Incorrect - circular dependency (importing public export from within same package)
  // In data-view/src/core/common/property-menu.ts:
  import { someFunction } from '@blocksuite/data-view/property-presets'; // Creates cycle!
  ```

### 🔄 Dependency Management

- **Watch for circular dependencies**: ESLint will catch import cycles that can break module loading
- **Within the same package**: Use relative imports to avoid circular dependencies
- **Between packages**: Use public package exports
- **Internal modules**: Should never import from their own package's public exports

### 🔍 Type Safety & Architecture

- **Respect type boundaries**: Use the correct object types from the appropriate architectural layer
  - `ColumnDataType`: Raw database model data
  - `Property`: View-layer objects with reactive features
- **Access data through proper channels**: Use view managers and data sources as intended
- **Example of correct property access**:

  ```typescript
  // ✅ Correct - using view manager to get Property objects
  const currentView = this.viewManager.currentView$.value;
  const property = currentView?.propertyGetOrCreate(propertyId);

  // ❌ Incorrect - mixing raw model data with view functions
  const columnData = getProperty(this._model, propertyId);
  initializeAllIds(columnData); // Type error!
  ```

### 💬 Comments

- All comments are in English.
- Add comments only where necessary:

  - For complex logic
  - To explain technical trade-offs

- Do not over-comment straightforward code

### 📚 Documentation

- Document new components, hooks, and utils in `/docs/` or in-code (`/** JSDoc style */`)
- Add Markdown-based docs if the feature is complex or architectural

### 📊 Tests

- Write unit and integration tests for all new features
- Use the existing testing frameworks (e.g., `vitest`, `playwright`)
- Place tests in `__tests__` directories or co-located with the source
- Run tests before submitting a pull request:

  ```bash
  yarn test
  yarn test:e2e
  ```

### 🔧 Code Quality & Linting

- **Run ESLint before committing**: Ensure code follows project standards
- **Fix auto-fixable issues**: Use `npx eslint --fix` for automatic corrections
- **Handle unused imports**: Remove unused imports to keep code clean
- **Catch parameter handling**: Use `_` prefix for intentionally unused parameters:

  ```typescript
  // ✅ Correct - marked as intentionally unused
  } catch (_error) {
    // fail silently
  }

  // ✅ Also correct - no parameter if not used
  } catch {
    // fail silently
  }
  ```

- **Import sorting**: Let ESLint auto-sort imports with `--fix` option

---

## 🔧 Local Setup & Commands

### 🏗 Build Project

```bash
yarn install
yarn build
```

### ▶️ Start the Application

To launch both the backend and frontend simultaneously:

```bash
yarn affine server dev & yarn affine web dev
```

> You may also run frontend and backend separately depending on your task.

### 🥪 Prisma Studio

AFFiNE uses **Prisma** as its ORM. You can explore and edit the local database using **Prisma Studio**:

```bash
yarn prisma studio
```

This opens a web interface to view and manage your development data. Useful for debugging database state during development.

### 🧪 Run Tests

```bash
yarn test               # Run unit tests
yarn test:e2e           # Run end-to-end tests
```

---

## 🎨 Block Preview in Dedicated Environment

AFFiNE provides a **block preview environment** for local development and testing of custom blocks.

To preview blocks:

1. Navigate to the block folder (usually `/blocks` or similar)
2. Launch the preview mode:

   ```bash
   yarn preview
   ```

3. Open the local preview in your browser to test UI rendering, interactivity, and performance.

Refer to internal AFFiNE documentation for more block-specific setup if needed.

---

## 🧠 Additional Guidance for GitHub Copilot

Please follow these principles when assisting:

- Always suggest implementations that follow the structure and conventions of AFFiNE.
- Use the current issue context to guide development planning and suggest next steps.
- Document your code clearly where appropriate.
- Flag architectural concerns or missing test coverage.
- Prefer functional and modern TypeScript/React patterns.
- Never suggest changing `.devcontainer` or CI/CD files unless explicitly instructed.
- Ensure compatibility with the build and test scripts defined in `package.json`.
- When suggesting code, use descriptive variable and function names aligned with existing naming patterns.
- If a Copilot suggestion is uncertain or incomplete, propose an inline comment to flag it for review instead of guessing the implementation.

---

## ✅ Summary of Priorities

1. Work exclusively on [https://github.com/ntexier-belenos/AFFiNE/](https://github.com/ntexier-belenos/AFFiNE/)
2. Use tickets to guide all contributions
3. Follow AFFiNE's coding and commit rules
4. Ensure builds, tests, and previews work locally
5. Never include `.devcontainer` or irrelevant commits in PRs
