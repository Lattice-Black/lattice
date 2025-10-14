# Lattice Scripts

## sync-to-public.sh

Syncs plugin packages from the private monorepo to the public lattice-plugins repository.

### Usage

```bash
# From the private lattice repo root
./scripts/sync-to-public.sh
```

The script will:
1. Check if the public repo exists locally, clone it if not
2. Pull latest changes from the public repo
3. Sync the three plugin packages (core, plugin-express, plugin-nextjs)
4. Show you the changes and prompt for confirmation
5. Commit and push to the public repo

### What Gets Synced

**Packages:**
- `packages/core/` → `lattice-plugins/packages/core/`
- `packages/plugin-express/` → `lattice-plugins/packages/plugin-express/`
- `packages/plugin-nextjs/` → `lattice-plugins/packages/plugin-nextjs/`

**Files:**
- `.github/workflows/publish-plugins.yml`

**Excluded:**
- `node_modules/`
- `dist/`
- `.turbo/`
- `*.log`

### Manual Sync

If you prefer to sync manually:

```bash
# Make changes in private repo
cd /Users/cwolff/Code/lattice

# Run sync script
./scripts/sync-to-public.sh

# Follow the prompts to commit and push
```

### Automated Sync (GitHub Actions)

The `.github/workflows/sync-plugins.yml` workflow automatically syncs changes when you push to the `main` branch and modify plugin packages.

**Setup:**

1. Create a Personal Access Token (PAT) on GitHub:
   - Go to https://github.com/settings/tokens/new
   - Select scopes: `repo` (all)
   - Generate token

2. Add token to repository secrets:
   ```bash
   cd /Users/cwolff/Code/lattice
   echo "YOUR_TOKEN_HERE" | gh secret set PUBLIC_REPO_TOKEN
   ```

3. The workflow will now automatically sync on every push to main that affects plugin packages

**Manual trigger:**

You can also manually trigger the sync workflow:

```bash
gh workflow run sync-plugins.yml
```

Or via GitHub UI:
- Go to https://github.com/Lattice-Black/lattice/actions/workflows/sync-plugins.yml
- Click "Run workflow"

## Troubleshooting

### Permission denied
```bash
chmod +x scripts/sync-to-public.sh
```

### Public repo not found
The script will automatically clone it, or you can manually:
```bash
cd /Users/cwolff/Code
git clone git@github.com:Lattice-Black/lattice-plugins.git
```

### GitHub Actions fails
Make sure `PUBLIC_REPO_TOKEN` secret is set:
```bash
gh secret list
```

If not set:
```bash
echo "YOUR_TOKEN" | gh secret set PUBLIC_REPO_TOKEN
```
