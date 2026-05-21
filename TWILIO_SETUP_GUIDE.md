# Twilio AI-Powered Calling Setup Guide

This guide will help you set up the AI-powered 3-way conference calling feature with automatic note-taking and email notifications.

## Features

✅ **3-Way Conference Calls**: Automatically connects agent, lead, and AI listener
✅ **AI Transcription & Analysis**: Records, transcribes, and analyzes conversations
✅ **Automated Notes**: Generates summary, key points, and next steps
✅ **Email Notifications**: Sends call notes to both agent and lead
✅ **Call History**: Stores all call notes against the lead profile

## Prerequisites

1. **Twilio Account**: Sign up at https://www.twilio.com
2. **Twilio Phone Number**: Purchase a phone number with voice capabilities
3. **Google AI API Key**: Already configured in your project
4. **Resend API Key**: Already configured for email sending

## Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial account (includes $15.50 credit)
3. Verify your phone number and email

## Step 2: Get Twilio Credentials

1. Log in to your Twilio Console: https://console.twilio.com
2. Navigate to **Account > API keys & tokens**
3. Find your credentials:
   - **Account SID**: Starts with `AC...`
   - **Auth Token**: Click "Show" to reveal

## Step 3: Purchase a Phone Number

1. In Twilio Console, go to **Phone Numbers > Manage > Buy a number**
2. Select your country (Canada recommended for your use case)
3. Filter by capabilities:
   - ✅ Voice
   - ✅ SMS (optional but recommended)
4. Choose a number and purchase it ($1-2/month)
5. Note your new phone number in E.164 format (e.g., `+14165551234`)

## Step 4: Configure Webhooks

1. Go to **Phone Numbers > Manage > Active numbers**
2. Click on your purchased number
3. Scroll to **Voice Configuration**:
   - **A Call Comes In**: Set to `Webhook`
   - **URL**: `https://your-domain.com/api/calls/twiml/agent`
   - **HTTP Method**: `POST`
4. Scroll to **Call Status Changes**:
   - **URL**: `https://your-domain.com/api/calls/status-callback`
   - **HTTP Method**: `POST`

## Step 5: Add Environment Variables

Add these to your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=AC...your_account_sid
TWILIO_AUTH_TOKEN=...your_auth_token
TWILIO_PHONE_NUMBER=+14165551234

# App URL (for webhooks)
APP_URL=https://your-domain.com

# Already configured:
GEMINI_API_KEY=...
RESEND_API_KEY=...
```

## Step 6: Install Dependencies

The following npm packages are required:

```bash
npm install twilio
```

This should already be in your `package.json` if you're running the project.

## Step 7: Test the Integration

1. **Start your server**:
   ```bash
   npm run dev
   ```

2. **Navigate to a lead details page**

3. **Click the "Call" button** next to the lead's name

4. **Test the flow**:
   - Agent phone rings first
   - Lead phone rings 5 seconds after agent answers
   - Both parties are connected in a conference
   - AI records and transcribes the conversation
   - After call ends, notes are emailed to both parties
   - Call notes appear in the lead's Call History section

## How It Works

### Call Flow

```
1. Agent clicks "Call Lead" button
   ↓
2. System creates Twilio conference
   ↓
3. Twilio calls agent's phone
   ↓
4. Agent answers and joins conference
   ↓
5. Twilio calls lead's phone (5s delay)
   ↓
6. Lead answers and joins conference
   ↓
7. AI listens and records conversation
   ↓
8. Call ends
   ↓
9. Recording is processed by AI
   ↓
10. AI generates:
    - Transcript
    - Summary
    - Key points
    - Next steps
    - Sentiment analysis
   ↓
11. Notes are saved to Firestore
   ↓
12. Email sent to agent & lead
   ↓
13. Call history updated in dashboard
```

### AI Processing

The system uses Google Gemini AI to:
- **Transcribe** the audio recording to text
- **Summarize** the conversation in 2-3 sentences
- **Extract key points** discussed during the call
- **Identify next steps** or action items
- **Analyze sentiment** (positive/neutral/negative)
- **Generate qualification insights** for the lead

## Pricing

### Twilio Costs (Pay-as-you-go)

- **Phone Number**: ~$1.00/month
- **Voice Calls**:
  - Outbound: ~$0.0130/minute per leg (2 legs = agent + lead)
  - Recording: ~$0.0025/minute
  - Transcription: ~$0.05/minute (optional, using AI instead)
- **Example**: 10-minute call costs approximately:
  - Agent leg: $0.13
  - Lead leg: $0.13
  - Recording: $0.025
  - **Total**: ~$0.29 per 10-minute call

### Free Tier

Twilio trial includes $15.50 credit (~50-60 calls)

## Troubleshooting

### Issue: "Twilio not configured" error

**Solution**: Verify all environment variables are set correctly in `.env`

### Issue: Calls not connecting

**Solution**: 
1. Check phone numbers are in E.164 format (+14165551234)
2. Verify Twilio number has voice capabilities
3. Check webhook URLs are publicly accessible (use ngrok for local dev)

### Issue: No recording or transcription

**Solution**:
1. Verify webhook URLs are correct
2. Check server logs for callback errors
3. Ensure `APP_URL` environment variable is set

### Issue: Emails not sending

**Solution**:
1. Verify `RESEND_API_KEY` is configured
2. Check sender email domain is verified in Resend
3. Review server logs for email sending errors

## Local Development with ngrok

For local testing, you need to expose your localhost to the internet:

1. **Install ngrok**: https://ngrok.com/download

2. **Start your server**:
   ```bash
   npm run dev
   ```

3. **In another terminal, run ngrok**:
   ```bash
   ngrok http 5000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Update your environment variable**:
   ```env
   APP_URL=https://abc123.ngrok.io
   ```

6. **Update Twilio webhooks** to use the ngrok URL:
   - `https://abc123.ngrok.io/api/calls/twiml/agent`
   - `https://abc123.ngrok.io/api/calls/recording-callback`
   - etc.

## Production Deployment

1. Deploy your app to a public server (Railway, Render, Heroku, etc.)
2. Set `APP_URL` to your production domain
3. Update Twilio webhooks to use production URLs
4. Monitor call logs in Twilio Console
5. Track costs in Twilio billing dashboard

## Security Best Practices

1. **Never commit** `.env` file to git
2. **Rotate credentials** periodically
3. **Use webhook signatures** to verify Twilio requests (optional enhancement)
4. **Restrict API keys** to specific IP ranges if possible
5. **Monitor usage** to detect anomalies

## Feature Enhancements (Future)

- [ ] Real-time call transcription display
- [ ] Automated follow-up email scheduling based on call sentiment
- [ ] Call recording playback within dashboard
- [ ] Multi-language support for transcription
- [ ] Call quality metrics and analytics
- [ ] Voicemail detection and transcription
- [ ] SMS follow-ups after calls

## Support

For issues or questions:
- **Twilio Docs**: https://www.twilio.com/docs/voice
- **Twilio Support**: https://support.twilio.com
- **LeadCrest Team**: support@leadcrest.com

---

**Setup Complete!** 🎉

You're now ready to make AI-powered calls with automatic note-taking.
