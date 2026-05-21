# LeadCrest - Google Cloud Platform Deployment Guide

This guide will walk you through deploying LeadCrest to Google Cloud Platform using Cloud Run.

## Prerequisites

1. **Google Cloud Account**
   - Create one at: https://cloud.google.com/
   - Enable billing (Cloud Run has a generous free tier)

2. **Google Cloud SDK (gcloud CLI)**
   - Install from: https://cloud.google.com/sdk/docs/install
   - For Windows: https://cloud.google.com/sdk/docs/install-sdk#windows

3. **Docker Desktop** (Optional - for local testing)
   - Download from: https://www.docker.com/products/docker-desktop/

## Step 1: Set Up Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create leadcrest-prod --name="LeadCrest Production"

# Set the project as active
gcloud config set project leadcrest-prod

# Enable billing for your project (required for Cloud Run)
# Go to: https://console.cloud.google.com/billing
```

## Step 2: Configure Firebase Service Account (Required)

Your app uses Firebase Admin SDK, so you need to provide credentials:

```bash
# 1. Go to Firebase Console: https://console.firebase.google.com/
# 2. Select your project
# 3. Go to Project Settings > Service Accounts
# 4. Click "Generate New Private Key"
# 5. Save the JSON file as 'firebase-service-account.json' in your project root
```

## Step 3: Set Environment Variables

Before deploying, you need to configure your environment variables in Cloud Run:

```bash
# After first deployment, update environment variables
gcloud run services update leadcrest \
  --region us-central1 \
  --set-env-vars REAL_GEMINI_KEY=YOUR_GEMINI_API_KEY \
  --set-env-vars RESEND_API_KEY=YOUR_RESEND_API_KEY \
  --set-env-vars APP_URL=https://leadcrest-[hash]-uc.a.run.app \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
```

## Step 4: Deploy to Cloud Run

### Option A: Using the Deployment Script (Recommended)

```bash
# Make the script executable (Git Bash on Windows)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### Option B: Manual Deployment

```bash
# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or deploy directly (simpler, but slower)
gcloud run deploy leadcrest \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --max-instances 10
```

## Step 5: Update Firebase Configuration

After deployment, update your Firebase settings:

```bash
# Get your Cloud Run URL
gcloud run services describe leadcrest --region us-central1 --format 'value(status.url)'

# Add this URL to Firebase Authorized Domains:
# 1. Go to Firebase Console > Authentication > Settings
# 2. Add your Cloud Run domain to "Authorized domains"
```

## Step 6: Set Up Custom Domain (Optional)

```bash
# Map a custom domain to your Cloud Run service
gcloud run domain-mappings create \
  --service leadcrest \
  --domain www.yourdomain.com \
  --region us-central1

# Follow the instructions to update your DNS records
```

## Testing Your Deployment

```bash
# View service details
gcloud run services describe leadcrest --region us-central1

# View logs in real-time
gcloud run services logs tail leadcrest --region us-central1

# Check health endpoint
curl https://your-app-url.run.app/api/health
```

## Updating Your Deployment

When you make code changes:

```bash
# Simply run the deployment script again
./deploy.sh

# Or use gcloud directly
gcloud builds submit --config cloudbuild.yaml
```

## Monitoring & Management

### View Logs
```bash
gcloud run services logs read leadcrest --region us-central1 --limit 50
```

### Update Environment Variables
```bash
gcloud run services update leadcrest \
  --region us-central1 \
  --set-env-vars KEY=VALUE
```

### Scale Configuration
```bash
gcloud run services update leadcrest \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1
```

### Delete Service
```bash
gcloud run services delete leadcrest --region us-central1
```

## Cost Estimation

Cloud Run Pricing (as of 2025):
- **Free tier**: 2 million requests/month, 360,000 GB-seconds/month
- **After free tier**: 
  - $0.00002400 per request
  - $0.00001800 per GB-second of memory
  - $0.00000900 per vCPU-second

**Estimated monthly cost for moderate traffic (10,000 requests/month):**
- ~$5-10/month (well within free tier for most use cases)

## Troubleshooting

### Build Fails
```bash
# Check Cloud Build logs
gcloud builds list --limit 5
gcloud builds log [BUILD_ID]
```

### Service Won't Start
```bash
# Check service logs
gcloud run services logs read leadcrest --region us-central1 --limit 100

# Describe service for details
gcloud run services describe leadcrest --region us-central1
```

### Firebase Connection Issues
- Ensure `firebase-service-account.json` is in your build
- Check `GOOGLE_APPLICATION_CREDENTIALS` env var is set correctly
- Verify Firebase project ID matches in `firebase-applet-config.json`

## Security Best Practices

1. **Use Secret Manager for sensitive data:**
```bash
# Store API keys in Secret Manager
echo -n "your-api-key" | gcloud secrets create gemini-api-key --data-file=-

# Reference in Cloud Run
gcloud run services update leadcrest \
  --update-secrets REAL_GEMINI_KEY=gemini-api-key:latest
```

2. **Enable Cloud Armor** for DDoS protection
3. **Set up Cloud CDN** for static assets
4. **Configure IAM** properly for service accounts

## CI/CD Integration (Optional)

To set up automatic deployments from GitHub:

1. Connect your GitHub repo to Cloud Build
2. Create a trigger in Cloud Build Console
3. Every push to `main` will auto-deploy

```bash
# Create trigger via CLI
gcloud builds triggers create github \
  --repo-name=leadcrest \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## Support

- Cloud Run Documentation: https://cloud.google.com/run/docs
- Cloud Build Documentation: https://cloud.google.com/build/docs
- GCP Console: https://console.cloud.google.com/

---

**Need Help?** 
- Check logs: `gcloud run services logs tail leadcrest --region us-central1`
- GCP Status: https://status.cloud.google.com/
