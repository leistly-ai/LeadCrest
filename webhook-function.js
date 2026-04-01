/**
 * STANDALONE GOOGLE CLOUD FUNCTIONS FOR TWILIO & LEAD PROCESSING (v5)
 * 1. twilioWebhook: Handles the elite agent conversation.
 * 2. processLeadStructuredData: Extracted predictors for predictive modeling.
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenAI } = require("@google/genai");

// Initialize Firebase Admin
initializeApp({
  projectId: "gen-lang-client-0668126006"
});

const db = getFirestore("ai-studio-91ce41d5-a8c5-4fd5-8ec7-3a94fa45e860");

/**
 * FUNCTION 1: TWILIO WEBHOOK (The "Elite Agent" Chat)
 * Deploy this as an HTTP Triggered Function.
 */
exports.twilioWebhook = async (req, res) => {
  const From = req.query.From || req.body.From;
  const Body = req.query.Body || req.body.Body;

  if (!From || !Body) {
    return res.status(200).send('<Response><Message>OK</Message></Response>');
  }

  try {
    // 1. Fetch History
    const historySnapshot = await db.collection('leads')
      .where('phone', '==', From)
      .orderBy('createdAt', 'desc')
      .limit(15)
      .get();

    let historyText = "";
    const historyDocs = historySnapshot.docs.reverse();
    historyDocs.forEach(doc => {
      const data = doc.data();
      if (data.message && data.aiResponse) {
        historyText += `User: ${data.message}\nAgent: ${data.aiResponse}\n`;
      }
    });

    // 2. AI Conversation Logic
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const systemPrompt = `You are 'LeadCrest AI', an elite, top-tier real estate sales agent. 
    Gather these details ONE BY ONE: Name, Email, Address, Salary, Mortgage Pre-auth, Months in Market, First-Time Buyer.
    
    TONE: Professional, warm, non-pushy. 
    RULE: Ask ONLY ONE question at a time.
    
    COMPLETION TRIGGER: When you have ALL the information, thank them and end with the exact tag: [CONVERSATION_COMPLETE]`;

    const fullPrompt = `${historyText}User: ${Body}\nAgent:`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: fullPrompt,
      config: { systemInstruction: systemPrompt }
    });

    const aiText = response.text;
    const isComplete = aiText.includes("[CONVERSATION_COMPLETE]");

    // 3. Save Message to DB
    const leadRef = await db.collection('leads').add({
      phone: From,
      message: Body,
      aiResponse: aiText,
      createdAt: new Date().toISOString(),
      status: isComplete ? 'completed' : 'active',
      agentId: process.env.AGENT_UID || 'admin@leistly.com'
    });

    // 4. Respond to Twilio
    res.set('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${aiText.replace("[CONVERSATION_COMPLETE]", "")}</Message></Response>`);

  } catch (error) {
    console.error('WEBHOOK ERROR:', error);
    res.status(200).send(`<Response><Message>Error: ${error.message}</Message></Response>`);
  }
};

/**
 * FUNCTION 2: STRUCTURED DATA EXTRACTOR (Predictive Model Input)
 * Deploy this as a Firestore Triggered Function (onDocumentCreated in 'leads' collection)
 * OR call it manually when status becomes 'completed'.
 */
exports.processLeadStructuredData = async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const data = snapshot.data();

  // Only run when a conversation is marked as completed
  if (data.status !== 'completed') return;

  try {
    const phone = data.phone;
    
    // 1. Get full conversation history
    const historySnapshot = await db.collection('leads')
      .where('phone', '==', phone)
      .orderBy('createdAt', 'asc')
      .get();

    let fullTranscript = "";
    historySnapshot.docs.forEach(doc => {
      const d = doc.data();
      fullTranscript += `User: ${d.message}\nAgent: ${d.aiResponse}\n`;
    });

    // 2. Use AI to extract "Predictors" for the model
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const extractionPrompt = `Analyze this real estate conversation and extract structured data for a predictive model.
    
    TRANSCRIPT:
    ${fullTranscript}

    OUTPUT JSON ONLY with these fields:
    - name (string)
    - email (string)
    - salary (number)
    - mortgage_preauth (number)
    - months_in_market (number)
    - is_first_time_buyer (boolean)
    - urgency_score (1-10: How fast do they want to move?)
    - motivation_type (Investment, Primary, Relocation, or Unknown)
    - sentiment (Positive, Neutral, Negative)
    - predictive_conversion_score (0-100: Probability of closing a deal)
    - key_objections (array of strings)`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: extractionPrompt,
      config: { responseMimeType: "application/json" }
    });

    const structuredData = JSON.parse(response.text);

    // 3. Store in a dedicated 'structured_leads' collection for the Predictive Model
    await db.collection('structured_leads').doc(phone).set({
      ...structuredData,
      phone: phone,
      processedAt: new Date().toISOString(),
      rawLeadId: snapshot.id,
      agentId: data.agentId
    });

    console.log(`Successfully extracted predictors for lead: ${phone}`);

  } catch (error) {
    console.error('EXTRACTION ERROR:', error);
  }
};

/**
 * FUNCTION 3: GOOGLE CONTACTS SYNC
 * Pulls contacts from Google People API and updates Firestore.
 * Deploy this as an HTTP Triggered Function.
 */
exports.syncGoogleContacts = async (req, res) => {
  const { uid } = req.body || req.query;
  if (!uid) {
    return res.status(400).send('Missing UID');
  }

  try {
    // 1. Get tokens from Firestore
    const tokenDoc = await db.collection('users').doc(uid).collection('config').doc('sync_tokens').get();
    if (!tokenDoc.exists) {
      return res.status(404).send('Tokens not found for user');
    }
    const tokenData = tokenDoc.data();

    // 2. Setup Google Auth
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: tokenData.refreshToken,
      access_token: tokenData.accessToken
    });

    // 3. Fetch Contacts
    const people = google.people({ version: 'v1', auth: oauth2Client });
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses',
    });

    const contacts = response.data.connections || [];
    const lastSyncAt = new Date().toISOString();

    // 4. Update Firestore
    await db.collection('agents').doc(uid).update({
      googleContacts: contacts,
      lastSyncAt
    });

    res.status(200).json({ 
      success: true, 
      contactsCount: contacts.length, 
      lastSyncAt 
    });

  } catch (error) {
    console.error('SYNC ERROR:', error);
    res.status(500).send(`Sync failed: ${error.message}`);
  }
};
