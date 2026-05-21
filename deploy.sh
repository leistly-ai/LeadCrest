#!/bin/bash

# LeadCrest GCP Deployment Script
# This script deploys the application to Google Cloud Run

set -e

echo "🚀 Starting deployment to Google Cloud Platform..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed."
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No GCP project is set."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📦 Project: $PROJECT_ID"
echo "🌍 Region: us-central1"

# Enable required APIs
echo "🔧 Enabling required GCP APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy
echo "🏗️  Building and deploying application..."
gcloud builds submit --config cloudbuild.yaml

# Get the service URL
SERVICE_URL=$(gcloud run services describe leadcrest --region us-central1 --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your application is live at: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Update your environment variables:"
echo "   gcloud run services update leadcrest --region us-central1 \\"
echo "     --set-env-vars REAL_GEMINI_KEY=YOUR_KEY,RESEND_API_KEY=YOUR_KEY,APP_URL=$SERVICE_URL"
echo ""
echo "2. View logs:"
echo "   gcloud run services logs read leadcrest --region us-central1"
echo ""
