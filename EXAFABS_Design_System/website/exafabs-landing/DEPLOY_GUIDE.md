# ExaFabs Website Deployment Guide

Complete step-by-step instructions for deploying the ExaFabs website (exafabs.ai) to Vercel.

## Prerequisites

- GitHub account
- Vercel account (free tier works fine)
- Domain name (exafabs.ai) with registrar access
- Local development environment with Git installed

---

## Part 1: Prepare Your Repository

### 1.1 Initialize Git Repository (if not already done)

```bash
cd /path/to/exafabs-landing
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 1.2 Create .gitignore

Create a `.gitignore` file to exclude unnecessary files:

```bash
cat > .gitignore << 'EOF'
node_modules/
.DS_Store
.env.local
.env.*.local
*.log
.vercel
dist/
build/
EOF
```

### 1.3 Ensure Project Structure

Your project should have this structure:

```
exafabs-landing/
├── index.html          # Main page
├── assets/             # Images, CSS, JS
│   ├── css/
│   ├── js/
│   └── images/
├── vercel.json         # Vercel configuration (included)
├── package.json        # Project metadata (included)
├── DEPLOY_GUIDE.md    # This file
└── .gitignore         # Git ignore rules
```

### 1.4 Commit Initial Files

```bash
git add .
git commit -m "Initial commit: ExaFabs landing page with Vercel config"
```

---

## Part 2: Push to GitHub

### 2.1 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `exafabs-landing`
3. Description: `ExaFabs - AI-Powered Gaming Studio landing page`
4. Choose: **Public** (for better visibility)
5. Do NOT initialize with README (we'll push ours)
6. Click "Create repository"

### 2.2 Connect Local Repository to GitHub

After creating the repository, GitHub will show these commands. Run them:

```bash
# Set the remote origin to your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/exafabs-landing.git

# Rename branch to main (if needed)
git branch -M main

# Push code to GitHub
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### 2.3 Verify Push

Check that your code is on GitHub by visiting:
```
https://github.com/YOUR_USERNAME/exafabs-landing
```

---

## Part 3: Connect to Vercel & Deploy

### 3.1 Import Project to Vercel (Web UI Method - Easiest)

#### Option A: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Search for your repository: `exafabs-landing`
5. Click **"Import"**

#### Configuration Settings

The import will show these options:

- **Framework Preset**: Select `Other` (static site)
- **Build Command**: Leave empty or use `echo 'Static site'`
- **Output Directory**: Leave empty
- **Environment Variables**: None needed (unless you add them later)

6. Click **"Deploy"** and wait for deployment to complete

---

### 3.2 Alternative: Deploy Using Vercel CLI

If you prefer command-line deployment:

#### Install Vercel CLI

```bash
npm install -g vercel
# or with yarn:
yarn global add vercel
```

#### Authenticate

```bash
vercel login
# This opens a browser to authenticate with GitHub/GitLab/Bitbucket
```

#### Deploy

```bash
# Navigate to your project directory
cd /path/to/exafabs-landing

# Deploy to Vercel
vercel
# Follow the prompts:
# - Set project name: exafabs-landing
# - Set project directory: ./
# - Modify settings? No (or configure as needed)
```

#### Production Deployment

```bash
# Deploy to production
vercel --prod
```

---

## Part 4: Configure Custom Domain

### 4.1 Add Domain in Vercel Dashboard

1. Go to your project: https://vercel.com/dashboard/YOUR_TEAM/exafabs-landing
2. Click on **"Settings"** tab
3. Go to **"Domains"** section
4. Enter: `exafabs.ai`
5. Click **"Add"**

Vercel will show you the required DNS records.

### 4.2 Configure DNS at Your Domain Registrar

You need to add DNS records where you registered exafabs.ai (GoDaddy, Namecheap, Route53, etc.)

**Common DNS Records to Add:**

Add an **A Record** or **CNAME Record** pointing to Vercel:

```
Type: CNAME
Name: @ (or leave blank for root domain)
Value: cname.vercel-dns.com
TTL: 3600 (or default)
```

**OR** if your registrar supports it, add an **A Record**:

```
Type: A
Name: @ (root domain)
Value: 76.76.19.132  (Vercel's IP - verify current IP on Vercel dashboard)
TTL: 3600
```

**For www subdomain (optional but recommended):**

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

### 4.3 Example: GoDaddy Configuration

1. Log in to GoDaddy
2. Go to **"My Domains"** → Select `exafabs.ai`
3. Click **"Manage DNS"**
4. Find the **"A"** or **"CNAME"** record section
5. Click **"Edit"** and update with Vercel's details (see Step 4.2)
6. Click **"Save"** and wait for DNS to propagate (5 minutes to 24 hours)

### 4.4 Example: Namecheap Configuration

1. Log in to Namecheap
2. Go to **"Dashboard"** → Select `exafabs.ai`
3. Click **"Manage"**
4. Go to **"Advanced DNS"** tab
5. Add or edit the CNAME record with Vercel's details
6. Click **"Save"** and wait for propagation

### 4.5 Verify Domain Configuration

After adding DNS records, Vercel will automatically check and verify. You'll see a status like:

- **Valid Configuration** (green checkmark) - domain is working
- **Pending Verification** - DNS is still propagating, wait 5-15 minutes

Test your domain:
```bash
# Check if DNS is propagated
nslookup exafabs.ai

# You should see Vercel's nameservers
```

---

## Part 5: HTTPS & Security

### 5.1 Automatic HTTPS

Vercel **automatically provisions and renews** SSL/TLS certificates via Let's Encrypt. You do NOT need to do anything.

Once your custom domain is verified, you'll see:
- **SSL Status**: ✓ Valid Certificate
- HTTPS automatically enabled on exafabs.ai

### 5.2 Force HTTPS (Optional)

To ensure all traffic uses HTTPS, add to `vercel.json` (already included):

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      {
        "key": "Strict-Transport-Security",
        "value": "max-age=31536000; includeSubDomains"
      }
    ]
  }
]
```

---

## Part 6: Automatic Deployments

### 6.1 Set Up Automatic Deployments from GitHub (Default)

Once connected, Vercel automatically deploys when you push to your GitHub repository:

1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update: Add new feature"
   git push origin main
   ```
3. Vercel automatically starts building and deploying
4. Check deployment status: https://vercel.com/dashboard/YOUR_TEAM/exafabs-landing

### 6.2 View Deployment Logs

In Vercel Dashboard:
1. Go to your project
2. Click **"Deployments"** tab
3. Click on any deployment to see logs
4. Check for errors or warnings

### 6.3 Preview Deployments

Vercel automatically creates preview deployments for:
- Every pull request
- Every commit to non-main branches

This lets you test changes before merging to production.

---

## Part 7: Project Structure & Asset Management

### 7.1 Recommended File Organization

```
exafabs-landing/
├── index.html
├── assets/
│   ├── css/
│   │   ├── styles.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── main.js
│   │   └── animations.js
│   ├── images/
│   │   ├── logo.svg
│   │   ├── hero.jpg
│   │   └── game-previews/
│   └── fonts/
│       └── custom-fonts.woff2
├── sitemap.xml
├── robots.txt
├── vercel.json
├── package.json
└── DEPLOY_GUIDE.md
```

### 7.2 Asset Caching

The `vercel.json` includes optimal caching:

- **Assets (images, CSS, JS)**: Cached for 1 year (immutable)
- **HTML (index.html)**: Cached for 1 hour, must revalidate
- **All pages**: Security headers applied

No additional configuration needed.

---

## Part 8: Monitoring & Maintenance

### 8.1 Check Deployment Status

```bash
# View current deployment
vercel ls

# View deployment details
vercel deployments
```

### 8.2 Monitor Performance

1. Go to Vercel Dashboard
2. Click your project
3. Tabs available:
   - **Overview**: Deployment status, recent activity
   - **Deployments**: All versions deployed
   - **Settings**: Domain, environment, build settings
   - **Logs**: Build and runtime logs

### 8.3 Update Website

To update your site:

1. Edit files locally (HTML, CSS, JS)
2. Test locally:
   ```bash
   npm run dev
   # Opens on http://localhost:3000
   ```
3. Commit and push:
   ```bash
   git add .
   git commit -m "Update: [description]"
   git push origin main
   ```
4. Vercel automatically deploys within seconds

---

## Part 9: Troubleshooting

### Issue: Domain shows "Invalid Configuration"

**Solution:**
1. Wait 15-30 minutes for DNS propagation
2. Verify DNS records match Vercel's requirements
3. Check your registrar's DNS management
4. Use `nslookup exafabs.ai` to confirm propagation

### Issue: HTTPS Not Working

**Solution:**
1. Ensure custom domain is verified in Vercel
2. Wait 5-10 minutes for certificate provisioning
3. Clear browser cache and try again
4. Check Vercel Dashboard for certificate status

### Issue: Website Shows Old Content

**Solution:**
1. Clear browser cache (Ctrl+Shift+Del or Cmd+Shift+Del)
2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
3. Check Vercel Deployments tab to ensure latest version is live
4. Wait 1-2 minutes if deployment is in progress

### Issue: Assets Not Loading (404 errors)

**Solution:**
1. Verify asset paths in HTML are correct (relative paths)
2. Check asset folder structure matches `vercel.json`
3. Ensure file names match exactly (case-sensitive on Linux)
4. Clear browser cache

### Issue: "Not Found" / 404 on refresh

**Solution:**
This is normal for single-page apps. `vercel.json` includes rewrites to route all requests to index.html. No action needed if already configured.

---

## Part 10: Best Practices

### 10.1 Version Control

Always use Git for version control:

```bash
# Before making changes, create a feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add: feature description"

# Push to GitHub
git push origin feature/my-feature

# Create Pull Request on GitHub for review
# Then merge to main
```

### 10.2 Commits & Deployment

- Meaningful commit messages help track changes
- Each push to `main` triggers a production deployment
- Use pull requests for team collaboration

### 10.3 Performance Optimization

- Compress images (use JPEG for photos, PNG/SVG for graphics)
- Minify CSS and JavaScript
- Use relative asset paths
- Leverage browser caching (configured in vercel.json)

### 10.4 Security Checklist

- HTTPS enabled (automatic)
- Security headers configured (in vercel.json)
- No API keys or secrets in code
- .gitignore excludes sensitive files

---

## Quick Reference: Commands

```bash
# Local development
npm run dev

# Initialize Git (first time only)
git init
git remote add origin <github-url>

# Push updates to GitHub (triggers deployment)
git add .
git commit -m "Your message"
git push origin main

# Deploy via CLI
npm install -g vercel
vercel login
vercel --prod

# Check deployment status
vercel ls
vercel deployments
```

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Domain Configuration**: https://vercel.com/docs/concepts/projects/domains
- **Static Site Hosting**: https://vercel.com/docs/concepts/deployments/static-assets
- **Custom Redirects**: https://vercel.com/docs/edge-network/redirects

---

## Deployment Checklist

Before going live, confirm:

- [ ] Repository created on GitHub
- [ ] Code pushed to GitHub
- [ ] Project imported in Vercel
- [ ] Deployment successful (no build errors)
- [ ] Custom domain added in Vercel Dashboard
- [ ] DNS records configured at registrar
- [ ] Domain verified in Vercel (green checkmark)
- [ ] HTTPS working (lock icon in browser)
- [ ] Website accessible at exafabs.ai
- [ ] Content displays correctly
- [ ] Assets load properly
- [ ] Links/navigation work
- [ ] Mobile responsive design works

---

**Deployment Complete!** Your ExaFabs website is now live at https://exafabs.ai
