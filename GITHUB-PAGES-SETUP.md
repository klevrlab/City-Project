# GitHub Pages Deployment Setup

## Repository: multiple_loc_sharks

This guide will help you deploy the `multiple_loc_sharks` repository to GitHub Pages using GitHub Actions.

---

## Step 1: Create the Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `multiple_loc_sharks`
3. Description: "AR Sharks Location-Based Tour - Multiple Locations"
4. Set to **Public** (required for free GitHub Pages)
5. Click **Create repository**

---

## Step 2: Enable GitHub Pages

1. Go to your repository: `https://github.com/Ganeshmohank/multiple_loc_sharks`
2. Click **Settings** tab
3. Scroll down to **Pages** (in left sidebar under "Code and automation")
4. Under **Source**, select:
   - **GitHub Actions** (not "Deploy from a branch")
5. Click **Save**

---

## Step 3: Push Your Code

The GitHub Actions workflow file has already been created at:
`.github/workflows/deploy-pages.yml`

Now push your code to GitHub:

```bash
cd "/Users/spartan/Documents/Immersion 2026/sharks-way-ar"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - AR Sharks Location Tour"

# Add remote
git remote add origin https://github.com/Ganeshmohank/multiple_loc_sharks.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## Step 4: Verify Deployment

1. Go to **Actions** tab in your repository
2. You should see a workflow run called "Deploy to GitHub Pages"
3. Wait for it to complete (green checkmark)
4. Your site will be live at:
   
   **https://ganeshmohank.github.io/multiple_loc_sharks/**

---

## Step 5: Test Your Site

Open the following URLs to test:

- **Landing page**: https://ganeshmohank.github.io/multiple_loc_sharks/
- **Marker demo**: https://ganeshmohank.github.io/multiple_loc_sharks/marker-demo.html
- **Location tour**: https://ganeshmohank.github.io/multiple_loc_sharks/location-tour.html

---

## Workflow Details

The workflow (`.github/workflows/deploy-pages.yml`) does the following:

1. **Triggers on**:
   - Push to `main` branch
   - Manual trigger via GitHub UI

2. **Permissions**:
   - Read repository contents
   - Write to GitHub Pages
   - Use ID token for deployment

3. **Deployment**:
   - Checks out code
   - Configures Pages
   - Uploads entire repository root as artifact
   - Deploys to GitHub Pages

---

## File Structure

Your repository should have:

```
multiple_loc_sharks/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml    ← GitHub Actions workflow
├── docs/                        ← Documentation
├── marker-demo.html
├── location-tour.html
├── index.html
├── shark-locations.json
├── plushie_shark.glb
├── pattern-shark.patt
├── *.svg
└── README.md
```

---

## Updating Your Site

Every time you push to the `main` branch, GitHub Pages will automatically redeploy:

```bash
git add .
git commit -m "Update AR experience"
git push origin main
```

Wait 1-2 minutes for deployment to complete.

---

## Troubleshooting

### Deployment fails
- Check **Actions** tab for error messages
- Ensure repository is **Public**
- Verify GitHub Pages is set to **GitHub Actions** source

### 404 errors
- Wait 2-3 minutes after first deployment
- Check file paths are correct (case-sensitive)
- Verify files are committed and pushed

### Assets not loading
- Check browser console for errors
- Ensure all file paths are relative (e.g., `./plushie_shark.glb`)
- Verify all assets are committed to repository

---

## Both Sites Running

You now have two independent GitHub Pages sites:

1. **Production**: https://ganeshmohank.github.io/immersion2026/
2. **Multiple Locations**: https://ganeshmohank.github.io/multiple_loc_sharks/

Each deploys independently when you push to their respective repositories.

---

## Next Steps

1. Push code to GitHub
2. Wait for deployment
3. Test on mobile device
4. Share the live URL!

Your AR Sharks tour will be live and accessible from any mobile device with GPS and camera! 🦈📱

OK