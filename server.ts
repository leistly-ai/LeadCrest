import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Use fs to read JSON to avoid ESM import issues with JSON modules
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

let adminDb: any = null;

console.log('Starting server.ts...');

// In-memory prefill cache — keyed by "leadId:stepId"
// Populated when agent sends email; consumed when lead opens signing link
const prefilledPdfCache = new Map<string, { pdf: string; fieldsFilled: number; cachedAt: number }>();
const PREFILL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Dedup map — prevents concurrent requests for the same key from all running Gemini
const prefillInFlight = new Map<string, Promise<{ pdf: string; fieldsFilled: number }>>();

// Core prefill logic — extracted so it can be called from both the API endpoint
// and the FINTRAC handler (which pre-warms the BRA cache after ID extraction).
async function buildPrefillPdf(params: {
  stepId?: string;
  pdfUrl?: string | null;
  basePdfBase64?: string; // already-filled PDF (e.g. FINTRAC pass); agent fields are drawn on top
  leadData: Record<string, any>;
  agentData: Record<string, any>;
}): Promise<{ pdf: string; fieldsFilled: number }> {
  const { stepId, pdfUrl, basePdfBase64, leadData, agentData } = params;
  const { PDFDocument } = await import('pdf-lib');

  // Helper: load the canonical flat PDF from disk for this step
  const loadFlatFromDisk = (): Buffer => {
    const localId = stepId || pdfUrl?.replace(/^\/documents\//, '').replace(/\.pdf$/, '');
    const localPath = path.join(process.cwd(), 'public', 'documents', `${localId}.pdf`);
    if (!fs.existsSync(localPath)) throw new Error(`No PDF found for step: ${localId}`);
    return fs.readFileSync(localPath);
  };

  let pdfBytes: Buffer;
  let resolvedBase = false; // true when basePdfBase64 is valid (flat, already-filled)

  if (basePdfBase64) {
    const candidate = Buffer.from(basePdfBase64, 'base64');
    // Validate: basePdfBase64 must be a flat PDF (0 form fields).
    // If it has fields it is a stale XFA/AcroForm PDF — discard and use disk copy.
    try {
      const { PDFDocument: PDFDocumentCheck } = await import('pdf-lib');
      const checkDoc = await PDFDocumentCheck.load(candidate, { ignoreEncryption: true });
      const checkFields = checkDoc.getForm().getFields();
      if (checkFields.length === 0) {
        pdfBytes = candidate;
        resolvedBase = true;
        console.log(`[Prefill] stepId=${stepId} — layering agent data on top of FINTRAC-prefilled PDF (${pdfBytes.length} bytes)`);
      } else {
        console.warn(`[Prefill] stepId=${stepId} — basePdfBase64 has ${checkFields.length} form fields (stale XFA/AcroForm cache); falling back to disk copy`);
        pdfBytes = loadFlatFromDisk();
      }
    } catch {
      pdfBytes = loadFlatFromDisk();
    }
  } else if (pdfUrl && (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://'))) {
    const fetchRes = await fetch(pdfUrl);
    if (!fetchRes.ok) throw new Error(`Could not fetch PDF: ${fetchRes.status}`);
    pdfBytes = Buffer.from(await fetchRes.arrayBuffer());
  } else {
    pdfBytes = loadFlatFromDisk();
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const fieldNames = fields.map(f => f.getName());

  // Flat PDF (no form fields) — use Gemini Vision to detect field positions and draw text overlay
  if (fieldNames.length === 0) {
    console.log(`[Prefill] stepId=${stepId} — flat PDF, using text overlay`);
    try {
      const ai = getAI();
      const { StandardFonts, rgb } = await import('pdf-lib');

      // Parse address components
      const addrRaw = leadData.address || '';
      const postalMatch = addrRaw.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i);
      const postalCode = postalMatch ? postalMatch[0].toUpperCase() : '';
      const addrParts = addrRaw.split(',').map((s: string) => s.trim());
      const streetFull = addrParts[0] || '';
      const streetNum = streetFull.match(/^\d+/)?.[0] || '';
      const streetName = streetFull.replace(/^\d+\s*/, '').trim();
      const city = addrParts[1] || '';

      // Parse start date into components
      const startDateRaw = agentData.startDate || agentData.date || '';
      const startDateObj = startDateRaw ? new Date(startDateRaw) : new Date();
      const startDay   = startDateObj.getDate().toString();
      const startMonth = startDateObj.toLocaleString('en-CA', { month: 'long' });
      const startYear  = startDateObj.getFullYear().toString().slice(-2);

      // Parse expiry date if provided
      const expiryDateRaw = agentData.expiryDate || '';
      const expiryDateObj = expiryDateRaw ? new Date(expiryDateRaw) : null;
      const expiryDay   = expiryDateObj ? expiryDateObj.getDate().toString() : '';
      const expiryMonth = expiryDateObj ? expiryDateObj.toLocaleString('en-CA', { month: 'long' }) : '';
      const expiryYear  = expiryDateObj ? expiryDateObj.getFullYear().toString().slice(-2) : '';

      // Three-prompt strategy based on what data is available:
      //  A) resolvedBase=true  → valid FINTRAC-prefilled base: agent-only fields on top
      //  B) resolvedBase=false + agent modal data present → fresh disk PDF: all fields in one pass
      //  C) resolvedBase=false + no agent data → FINTRAC background call: buyer fields only
      const hasAgentModalData = !!(agentData.commission || agentData.startDate || agentData.brokeragePhone !== undefined);

      const overlayPrompt = resolvedBase
        ? // ── A: agent fields on top of already buyer-filled PDF ───────────────────
          `This OREA Form 300 PDF already has the buyer's name and address filled in.
Add ONLY the brokerage, agreement term, property, and commission fields that are still blank.
Do NOT place text where text already appears in the PDF.

For each field return its position as x_pct (% from left) and y_pct (% from top) of the PAGE it is on (page_index 0=page 1, 1=page 2, 2=page 3). Position text slightly above each blank line.

PAGE 1 (page_index: 0):
- Blank next to "BROKERAGE:" label → brokerage name: "${agentData.brokerage || ''}"
- "Tel. No." field near brokerage → tel: "${agentData.brokeragePhone || ''}"
- "ADDRESS:" field below BROKERAGE label → brokerage address: "${agentData.brokerageAddress || ''}"
- Blank near "commencing" / start "day of" → start day: "${startDay}"
- Month blank near "commencing" → start month: "${startMonth}"
- Year (20__) near "commencing" → start year: "${startYear}"
- Blank near "expiring" / end "day of" → expiry day: "${expiryDay}"
- Month blank near "expiring" → expiry month: "${expiryMonth}"
- Year (20__) near "expiring" → expiry year: "${expiryYear}"

PAGE 2 (page_index: 1):
- "Property Type [Use]" blank line → property type: "${agentData.propertyType || ''}"
- Specific property address blank line → address: "${agentData.propertyAddress || ''}"
- "Geographic Location" blank line → location: "${agentData.geographicLocation || ''}"
- Commission / remuneration blank → commission: "${agentData.commission || ''}"

PAGE 3 (page_index: 2):
- "Name of Person Signing" blank → agent name: "${agentData.name || ''}"
- Date "day of" on page 3 → today's day: "${startDay}"
- Month on page 3 → today's month: "${startMonth}"
- Year (20__) on page 3 → today's year: "${startYear}"

Return ONLY a valid JSON array (no markdown, no explanation). Skip fields whose value is empty string:
[
  { "label": "FIELD_LABEL", "page_index": <0|1|2>, "x_pct": <0-100>, "y_pct": <0-100>, "value": "<value>" }
]`

        : hasAgentModalData
        ? // ── B: fresh disk PDF with both buyer and agent data ─────────────────────
          `This is a blank OREA Form 300 Buyer Representation Agreement PDF. Fill in ALL blank fields across all three pages.

For each field return its position as x_pct (% from left) and y_pct (% from top) of the PAGE it is on (page_index 0=page 1, 1=page 2, 2=page 3). Position text slightly above each blank line.

PAGE 1 (page_index: 0):
- Blank next to "BROKERAGE:" label → brokerage name: "${agentData.brokerage || ''}"
- "Tel. No." field near brokerage → tel: "${agentData.brokeragePhone || ''}"
- "ADDRESS:" field below BROKERAGE label → brokerage address: "${agentData.brokerageAddress || ''}"
- Next to "BUYER(S):" label → buyer name: "${leadData.name || ''}"
- "Street Number" sub-label under buyer ADDRESS → street number: "${streetNum}"
- "Street Name" sub-label under buyer ADDRESS → street name: "${streetName}"
- "MUNICIPALITY:" field → city: "${city}"
- "POSTAL CODE:" field → postal code: "${postalCode}"
- Blank near "commencing" / start "day of" → start day: "${startDay}"
- Month blank near "commencing" → start month: "${startMonth}"
- Year (20__) near "commencing" → start year: "${startYear}"
- Blank near "expiring" / end "day of" → expiry day: "${expiryDay}"
- Month blank near "expiring" → expiry month: "${expiryMonth}"
- Year (20__) near "expiring" → expiry year: "${expiryYear}"

PAGE 2 (page_index: 1):
- "Property Type [Use]" blank line → property type: "${agentData.propertyType || ''}"
- Specific property address blank line → address: "${agentData.propertyAddress || ''}"
- "Geographic Location" blank line → location: "${agentData.geographicLocation || ''}"
- Commission / remuneration blank → commission: "${agentData.commission || ''}"

PAGE 3 (page_index: 2):
- "Name of Person Signing" blank → agent name: "${agentData.name || ''}"
- Date "day of" on page 3 → today's day: "${startDay}"
- Month on page 3 → today's month: "${startMonth}"
- Year (20__) on page 3 → today's year: "${startYear}"

Return ONLY a valid JSON array (no markdown, no explanation). Skip fields whose value is empty string:
[
  { "label": "FIELD_LABEL", "page_index": <0|1|2>, "x_pct": <0-100>, "y_pct": <0-100>, "value": "<value>" }
]`

        : // ── C: FINTRAC background call — buyer fields only ───────────────────────
          `This is a blank OREA Form 300 Buyer Representation Agreement PDF.
Fill in only the BUYER information fields listed below.

For each field return its position as x_pct (% from left) and y_pct (% from top) of the PAGE it is on (page_index 0=page 1). Position text slightly above each blank line.

PAGE 1 (page_index: 0):
- Next to "BUYER(S):" label → buyer name: "${leadData.name || ''}"
- "Street Number" sub-label under buyer ADDRESS → street number: "${streetNum}"
- "Street Name" sub-label under buyer ADDRESS → street name: "${streetName}"
- "MUNICIPALITY:" field → city: "${city}"
- "POSTAL CODE:" field → postal code: "${postalCode}"

Return ONLY a valid JSON array (no markdown, no explanation). Skip fields whose value is empty string:
[
  { "label": "FIELD_LABEL", "page_index": <0|1|2>, "x_pct": <0-100>, "y_pct": <0-100>, "value": "<value>" }
]`;

      const result = await generateWithFallback(ai, {
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdfBytes.toString('base64') } },
            { text: overlayPrompt },
          ],
        }],
      });

      const raw = (result?.text || '').trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const overlayFields: { label: string; page_index?: number; x_pct: number; y_pct: number; value: string }[] = JSON.parse(raw);

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      let drawn = 0;

      for (const f of overlayFields) {
        if (!f.value || f.x_pct == null || f.y_pct == null) continue;
        const pageIdx = Math.min(f.page_index ?? 0, pages.length - 1);
        const pg = pages[pageIdx];
        const { width: pw, height: ph } = pg.getSize();
        const x = (f.x_pct / 100) * pw;
        const y = ph - (f.y_pct / 100) * ph;
        pg.drawText(f.value, { x, y, size: 9, font, color: rgb(0, 0, 0) });
        drawn++;
        console.log(`[Prefill] Overlay p${pageIdx}: "${f.label}" = "${f.value}" at (${f.x_pct}%, ${f.y_pct}%)`);
      }

      // Embed agent signature on page 3 if provided
      // BRA page 3: "(Authorized to bind the Brokerage)" line is ~59% from top = 41% from bottom
      const agentSigDataUrl: string = agentData.agentSignature || '';
      if (agentSigDataUrl && pages.length >= 3) {
        try {
          const sigBase64 = agentSigDataUrl.replace(/^data:image\/png;base64,/, '');
          const sigImage = await pdfDoc.embedPng(Buffer.from(sigBase64, 'base64'));
          const p3 = pages[2];
          const { width: pw3, height: ph3 } = p3.getSize();
          const dims = sigImage.scaleToFit(150, 35);
          // "(Authorized to bind the Brokerage)" line — ~62% from top = 38% from bottom
          p3.drawImage(sigImage, { x: pw3 * 0.05, y: ph3 * 0.38, width: dims.width, height: dims.height });
          drawn++;
          console.log('[Prefill] Agent signature embedded on page 3 at y=38%');
        } catch (sigErr) {
          console.warn('[Prefill] Could not embed agent signature:', (sigErr as any)?.message);
        }
      }

      // Embed agent (brokerage) initials on ALL pages — "INITIALS OF BROKERAGE:" oval is on the LEFT side
      // at the very bottom of each page (~3% from bottom).
      const agentInitialsDataUrl: string = agentData.agentInitials || '';
      if (agentInitialsDataUrl && pages.length >= 1) {
        try {
          const initBase64 = agentInitialsDataUrl.replace(/^data:image\/png;base64,/, '');
          const initImage = await pdfDoc.embedPng(Buffer.from(initBase64, 'base64'));
          for (const pg of pages) {
            const { width: pw, height: ph } = pg.getSize();
            const dims = initImage.scaleToFit(50, 25);
            // "INITIALS OF BROKERAGE:" oval — LEFT side, very bottom of each page
            pg.drawImage(initImage, { x: pw * 0.08, y: ph * 0.04, width: dims.width, height: dims.height });
          }
          drawn += pages.length;
          console.log(`[Prefill] Agent initials embedded on all ${pages.length} pages (left oval, bottom)`);
        } catch (initErr) {
          console.warn('[Prefill] Could not embed agent initials:', (initErr as any)?.message);
        }
      }

      const filledBytes = await pdfDoc.save({ useObjectStreams: false });
      console.log(`[Prefill] stepId=${stepId} flat overlay drawn=${drawn}`);
      return { pdf: Buffer.from(filledBytes).toString('base64'), fieldsFilled: drawn };
    } catch (overlayErr: any) {
      console.warn('[Prefill] Text overlay failed, returning original:', overlayErr.message);
      return { pdf: pdfBytes.toString('base64'), fieldsFilled: 0 };
    }
  }

  // All supported PDFs are flat (no form fields). If we reach here the PDF has
  // AcroForm fields, meaning it is a legacy XFA/fillable document that slipped through.
  // Return the raw bytes unfilled — the caller should replace this document.
  console.warn(`[Prefill] stepId=${stepId} — PDF has ${fieldNames.length} form fields (legacy AcroForm/XFA). Only flat PDFs are supported. Returning original unfilled.`);
  return { pdf: pdfBytes.toString('base64'), fieldsFilled: 0 };
}

// ── Gemini helpers (module-level so buildPrefillPdf can use them) ─────────────
function getAI(keyOverride?: string): GoogleGenAI {
  let source = 'override';
  let rawKey = keyOverride;

  if (!rawKey) {
    const possibleKeys = [
      { name: 'REAL_GEMINI_KEY',              val: process.env.REAL_GEMINI_KEY },
      { name: 'GEMINI_API_KEY',               val: process.env.GEMINI_API_KEY },
      { name: 'NEXT_PUBLIC_GEMINI_API_KEY',   val: process.env.NEXT_PUBLIC_GEMINI_API_KEY },
      { name: 'GOOGLE_AI_KEY',                val: process.env.GOOGLE_AI_KEY },
      { name: 'API_KEY',                      val: process.env.API_KEY },
      { name: 'GOOGLE_API_KEY_ALT',           val: process.env.GOOGLE_API_KEY },
      { name: 'VITE_GEMINI_API_KEY',          val: process.env.VITE_GEMINI_API_KEY },
    ];
    for (const k of possibleKeys) {
      if (k.val && k.val !== 'MY_GEMINI_API_KEY' && !k.val.includes('YOUR_') && k.val.length > 10) {
        rawKey = k.val; source = k.name; break;
      }
    }
    if (!rawKey) {
      rawKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      source = 'none found (showing fallback)';
    }
  }

  if (!rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey.includes('YOUR_')) {
    throw new Error('No valid API key found. Please update GEMINI_API_KEY with your actual AIza... key.');
  }

  const key = rawKey
    .replace(/Gemini API Key • /g, '')
    .replace(/^(key|value|api_key|gemini_api_key):\s*/i, '')
    .replace(/["']/g, '')
    .replace(/[•…\s]/g, '')
    .trim();

  if (!key.startsWith('AIza')) {
    throw new Error(`Invalid key format from ${source}. Gemini API keys must start with 'AIza'. Your current key starts with '${key.substring(0, 4)}'.`);
  }

  console.log(`[AI] Initializing with key from ${source}: ${key.substring(0, 6)}...${key.substring(key.length - 4)}`);
  return new GoogleGenAI({ apiKey: key });
}

async function generateWithFallback(aiInstance: GoogleGenAI, params: any) {
  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
  let lastError = null;
  for (const modelName of models) {
    try {
      console.log(`[AI] Attempting ${modelName}...`);
      const response = await aiInstance.models.generateContent({ ...params, model: modelName });
      return response;
    } catch (error: any) {
      lastError = error;
      if ((error.message || '').match(/not found|not supported/)) {
        console.warn(`[AI] ${modelName} unavailable, trying next...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Session store removed - using web-based stateful chat components instead

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  console.log('[Server] Starting server in isolation mode...');

  // 1. BODY PARSERS (Must be BEFORE routes that use req.body)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Serve public/ folder so PDFs at /documents/*.pdf are accessible in dev and prod
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Initialize Firebase Admin inside startServer and wrap in try-catch
  try {
    console.log('[Firebase Admin] Initializing with config:', JSON.stringify({
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    }));

    let app;
    if (getApps().length === 0) {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const credential = serviceAccountPath
        ? cert(JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf8')))
        : undefined;
      app = initializeApp({
        ...(credential ? { credential } : {}),
        projectId: firebaseConfig.projectId,
      });
      console.log(`[Firebase Admin] Initialized with ${credential ? 'service account' : 'default credentials'}`);
    } else {
      app = getApps()[0];
    }
    // Use the specific firestoreDatabaseId if provided in the config
    adminDb = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    console.log(`[Firebase Admin] Firestore initialized with database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
  }

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      firebaseAdmin: getApps().length > 0,
      adminDb: !!adminDb,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
    });
  });

  // DEBUG: Specific log for disconnect route registration
  console.log('[Server] Registering /api/auth/google/disconnect route...');
  app.post('/api/auth/google/disconnect', async (req, res) => {
    const { uid } = req.body;
    console.log(`[OAuth Disconnect Request] Received UID: ${uid}`);
    if (!uid) return res.status(400).json({ error: 'Missing UID' });

    try {
      if (!adminDb) {
        console.error('[OAuth Disconnect Error]: adminDb is not initialized');
        throw new Error('Firebase Admin not initialized');
      }

      // Delete from agents collection
      console.log(`[OAuth Disconnect] Attempting to update agents collection for UID: ${uid}`);

      // Check if FieldValue is available
      if (!FieldValue) {
        console.error('[OAuth Disconnect Error]: FieldValue is not available');
        throw new Error('Firestore FieldValue not available');
      }

      await adminDb.collection('agents').doc(uid as string).update({
        googleContactsConnected: false,
        googleEmail: '',
        googleRefreshToken: FieldValue.delete(),
        googleContacts: FieldValue.delete(),
        lastSyncAt: FieldValue.delete()
      });
      console.log(`[OAuth Disconnect] Successfully updated agents collection for UID: ${uid}`);

      // Also delete from users/{uid}/config/sync_tokens if it exists
      try {
        console.log(`[OAuth Disconnect] Attempting to delete sync_tokens for UID: ${uid}`);
        await adminDb.collection('users').doc(uid as string).collection('config').doc('sync_tokens').delete();
        console.log(`[OAuth Disconnect] Successfully deleted sync_tokens for UID: ${uid}`);
      } catch (e: any) {
        console.warn('[OAuth Disconnect Warning]: Could not delete sync_tokens doc:', e.message);
      }

      res.json({ status: 'ok' });
    } catch (error: any) {
      console.error('[OAuth Disconnect Error]:', error);
      res.status(500).json({
        error: 'Failed to disconnect',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // SMS/WhatsApp webhooks removed - using web-only approach for lead qualification
  // All lead capture happens through web-based chat interface (/chat/:agentId and /demo-chat)

  // 5. GLOBAL CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Twilio-Signature, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 6. API ROUTES
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Send Document Email to Lead ────────────────────────────────────────
  // Firestore reads/writes are handled client-side; server only sends email.
  app.post('/api/send-document-email', async (req, res) => {
    const { leadEmail, leadName, agentEmail, agentName, leadId, stepId, stepTitle, docLabel, stepPhase } = req.body;
    if (!leadEmail || !stepTitle || !leadId || !stepId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) return res.status(500).json({ error: 'Email service not configured' });

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      // FINTRAC uses a dedicated ID upload page; all other steps use the signing flow
      const signingLink = stepId === 'fintrac'
        ? `${appUrl}/fintrac/${leadId}`
        : `${appUrl}/sign/${leadId}/${stepId}`;
      const firstName = leadName?.split(' ')[0] || leadName || 'there';
      const agentDisplayName = agentName || 'Your Agent';

      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'LeadCrest <notifications@leistly.com>',
        to: leadEmail,
        cc: agentEmail ? [agentEmail] : undefined,
        subject: `Action Required: Please review and sign "${stepTitle}"`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #2d2d2d; background: #f5f0eb; padding: 32px 16px;">
            <div style="background: #1E3A5F; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">LEADCREST</h1>
              <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Secure Document Signing</p>
            </div>
            <div style="background: #fff; padding: 32px; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin: 0 0 8px;">Hi ${firstName},</p>
              <p style="font-size: 14px; color: #666; margin: 0 0 24px;">${agentDisplayName} has sent you a document to review and sign as part of your real estate transaction.</p>
              <div style="background: #f9f9f9; border: 1px solid #e4e4e7; border-radius: 10px; padding: 20px; margin-bottom: 28px;">
                <p style="font-size: 11px; color: #D4A373; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 6px;">${stepPhase || 'Transaction Document'}</p>
                <p style="font-size: 18px; font-weight: 900; color: #1E3A5F; margin: 0 0 4px;">${stepTitle}</p>
                <p style="font-size: 12px; color: #888; margin: 0;">Form / Reference: <strong>${docLabel}</strong></p>
              </div>
              <p style="font-size: 14px; color: #666; margin: 0 0 24px;">${stepId === 'fintrac'
                ? 'Click the button below to securely upload a photo of your government-issued ID. This takes less than a minute and is required by federal law.'
                : 'Click the button below to review the full document summary, draw your electronic signature, and confirm your signed copy. The entire process takes less than 2 minutes.'}</p>
              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${signingLink}" style="display: inline-block; background: #D4A373; color: #fff; font-weight: 900; text-decoration: none; padding: 16px 36px; border-radius: 10px; font-size: 15px;">
                  ${stepId === 'fintrac' ? 'Upload ID for Verification →' : 'Review &amp; Sign Document →'}
                </a>
              </div>
              <p style="font-size: 12px; color: #aaa; margin: 0 0 8px;">This link is secure and personalized for you. If you have any questions before signing, please contact ${agentDisplayName} directly.</p>
              <p style="font-size: 11px; color: #ccc; margin: 0;">Electronic signatures are legally binding under the Electronic Commerce Act (Ontario).</p>
            </div>
          </div>
        `,
      });

      console.log(`[Email] Document email sent to ${leadEmail} (CC: ${agentEmail}) for step ${stepId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Email] Error sending document email:', error);
      res.status(500).json({ error: error.message || 'Failed to send email' });
    }
  });

  // ── FINTRAC ID Upload & Extraction ────────────────────────────────────
  // Lead submits their government ID. Gemini Vision extracts fields.
  // Raw ID is emailed to agent and NOT stored anywhere on the server.
  app.post('/api/fintrac-submit', async (req, res) => {
    const { leadId, idType, idFile, mimeType, leadEmail, leadName, agentEmail, agentName,
            agentBrokerage, agentBraUrl } = req.body;
    if (!leadId || !idFile || !mimeType || !agentEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const resendKey = process.env.RESEND_API_KEY;
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const agentDisplayName = agentName || 'Your Agent';
      const submittedAt = new Date().toISOString();

      // Strip data URL prefix to get raw base64
      const base64Image = idFile.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64Image, 'base64');
      const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg';
      const idFilename = `${(leadName || 'lead').replace(/\s+/g, '_')}_ID.${ext}`;

      // ── Gemini Vision: extract ID fields ──────────────────────────────
      let extractedData: Record<string, string> = {};
      try {
        const ai = getAI();
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              {
                inlineData: { mimeType, data: base64Image },
              },
              {
                text: `You are a data extraction assistant. Extract information from this government-issued ID document (${idType || 'ID'}).
Return ONLY a valid JSON object with these exact keys — use empty string "" for any field not visible:
{
  "fullName": "full legal name exactly as printed",
  "dateOfBirth": "YYYY-MM-DD format",
  "address": "full address including street, city, province/state",
  "idNumber": "document/licence/passport number",
  "expiryDate": "YYYY-MM-DD format",
  "jurisdiction": "province, territory, or country that issued the document",
  "country": "country shown on document"
}
Return only the JSON object, no markdown, no explanation.`,
              },
            ],
          }],
        });

        const rawText = (result.text || '').trim();
        console.log('[FINTRAC] Gemini raw response:', rawText.substring(0, 500));
        // Try direct parse first, then extract JSON object from response
        try {
          const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
          extractedData = JSON.parse(cleaned);
        } catch {
          // Fallback: find the first {...} block in the response
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            extractedData = JSON.parse(match[0]);
          } else {
            throw new Error('No JSON object found in Gemini response');
          }
        }
        console.log('[FINTRAC] Extracted data:', JSON.stringify(extractedData));
      } catch (geminiErr: any) {
        console.error('[FINTRAC] Gemini extraction failed:', geminiErr.message);
        // Non-fatal — we still send the email with empty extracted fields
      }

      // ── Update lead document with verified identity data ───────────────
      // This ensures the BRA (signed next) is pre-filled with the real legal
      // name and address from the government-issued ID, not just the intake form.
      if (adminDb && leadId && Object.keys(extractedData).length > 0) {
        try {
          const leadUpdate: Record<string, string> = {};
          if (extractedData.fullName) leadUpdate.name = extractedData.fullName;
          if (extractedData.address) leadUpdate.currentAddress = extractedData.address;
          if (extractedData.dateOfBirth) leadUpdate.dateOfBirth = extractedData.dateOfBirth;
          if (Object.keys(leadUpdate).length > 0) {
            await adminDb.collection('leads').doc(leadId).update(leadUpdate);
            console.log(`[FINTRAC] Updated lead ${leadId} with verified ID data:`, JSON.stringify(leadUpdate));
          }
        } catch (updateErr: any) {
          console.error('[FINTRAC] Failed to update lead with ID data:', updateErr.message);
          // Non-fatal — ID was still received and emailed
        }
      }

      // ── Emails ────────────────────────────────────────────────────────
      if (resendKey) {
        const resend = new Resend(resendKey);
        const submittedDateStr = new Date(submittedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'full', timeStyle: 'short' });
        const idTypeLabel: Record<string, string> = {
          drivers_licence: "Driver's Licence",
          passport: 'Passport',
          pr_card: 'Permanent Resident Card',
          foreign_passport: 'Foreign Passport',
        };
        const idLabel = idTypeLabel[idType] || idType || 'Government ID';
        const fintracRecordUrl = `${appUrl}/fintrac-record/${leadId}`;
        const extractedRows = [
          ['Full Name', extractedData.fullName],
          ['Date of Birth', extractedData.dateOfBirth],
          ['Address', extractedData.address],
          ['ID Type', idLabel],
          ['ID Number', extractedData.idNumber],
          ['Expiry Date', extractedData.expiryDate],
          ['Jurisdiction', extractedData.jurisdiction],
        ].filter(([, v]) => v).map(([k, v]) => `
          <tr><td style="color:#888;padding:5px 0;width:140px;">${k}</td><td style="font-weight:700;">${v}</td></tr>`).join('');

        // Email 1 → Agent (TO) + Lead (CC): ID attached, extracted data, link to FINTRAC record
        await resend.emails.send({
          from: 'LeadCrest <notifications@leistly.com>',
          to: agentEmail,
          cc: leadEmail ? [leadEmail] : undefined,
          subject: `🪪 ${leadName} submitted ID for FINTRAC verification`,
          attachments: [{ filename: idFilename, content: fileBuffer, contentType: mimeType }],
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2d2d2d;background:#f5f0eb;padding:32px 16px;">
              <div style="background:#1E3A5F;padding:24px 32px;border-radius:12px 12px 0 0;">
                <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">LEADCREST</h1>
                <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;">FINTRAC ID Received</p>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 12px 12px;">
                <p style="font-size:16px;margin:0 0 8px;">Hi ${agentDisplayName},</p>
                <p style="font-size:14px;color:#666;margin:0 0 24px;"><strong>${leadName}</strong> has submitted their ${idLabel} for FINTRAC identity verification. The original ID image is attached to this email. It has <strong>not been stored</strong> in LeadCrest.</p>
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin-bottom:24px;">
                  <p style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 6px;">🤖 Auto-Extracted Information</p>
                  <p style="font-size:12px;color:#1e3a8a;margin:0 0 12px;">The following fields were extracted from the ID using AI. Please verify against the attached image.</p>
                  <table style="width:100%;font-size:13px;border-collapse:collapse;">${extractedRows || '<tr><td colspan="2" style="color:#888;">Could not extract fields automatically — please review the attached ID.</td></tr>'}</table>
                </div>
                <div style="background:#f9f9f9;border:1px solid #e4e4e7;border-radius:10px;padding:16px;margin-bottom:24px;">
                  <table style="width:100%;font-size:13px;border-collapse:collapse;">
                    <tr><td style="color:#888;padding:4px 0;width:140px;">Lead</td><td style="font-weight:700;">${leadName}</td></tr>
                    <tr><td style="color:#888;padding:4px 0;">Email</td><td style="font-weight:700;">${leadEmail || '—'}</td></tr>
                    <tr><td style="color:#888;padding:4px 0;">Submitted</td><td style="font-weight:700;">${submittedDateStr} (Toronto)</td></tr>
                  </table>
                </div>
                <a href="${fintracRecordUrl}" style="display:inline-block;background:#D4A373;color:#fff;font-weight:900;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;">
                  View &amp; Download FINTRAC Record →
                </a>
                <p style="font-size:11px;color:#ccc;margin-top:28px;">Sent by LeadCrest · Original ID attached · Not stored in application.</p>
              </div>
            </div>`,
        });

        // Email 2 → Lead: confirmation only, no ID attachment
        if (leadEmail) {
          await resend.emails.send({
            from: 'LeadCrest <notifications@leistly.com>',
            to: leadEmail,
            subject: 'Your ID has been received — FINTRAC Verification',
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2d2d2d;background:#f5f0eb;padding:32px 16px;">
                <div style="background:#1E3A5F;padding:24px 32px;border-radius:12px 12px 0 0;">
                  <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">LEADCREST</h1>
                  <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;">FINTRAC Verification Confirmation</p>
                </div>
                <div style="background:#fff;padding:32px;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 12px 12px;">
                  <p style="font-size:16px;margin:0 0 8px;">Hi ${(leadName || '').split(' ')[0] || 'there'},</p>
                  <p style="font-size:14px;color:#666;margin:0 0 24px;">Thank you — your ${idLabel} has been securely forwarded to your real estate agent for FINTRAC identity verification. No further action is required from you at this time.</p>
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:24px;">
                    <p style="font-size:13px;font-weight:700;color:#166534;margin:0 0 4px;">✅ Verification Submitted</p>
                    <p style="font-size:12px;color:#166534;margin:0;">Your ID was submitted on ${submittedDateStr} (Toronto time). Your agent will complete the FINTRAC record and may follow up if additional information is needed.</p>
                  </div>
                  <p style="font-size:11px;color:#ccc;margin-top:16px;">Sent by LeadCrest · Your ID was not stored in this application · Keep this email for your records.</p>
                </div>
              </div>`,
          });
        }

        console.log(`[FINTRAC] ID received — agent: ${agentEmail}, lead: ${leadEmail}`);
      }

      // Respond immediately — BRA prefill runs in background on the client side
      res.json({ success: true, extractedData, submittedAt });
    } catch (error: any) {
      console.error('[FINTRAC] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to process submission' });
    }
  });

  // ── Document Prefill Endpoint ──────────────────────────────────────────
  // Fetches a PDF (from Firebase Storage URL or local default), detects AcroForm
  // fields via pdf-lib, maps them to lead data using Gemini, and returns a
  // pre-filled PDF as base64. Unrecognised fields are left blank.
  app.post('/api/prefill-document', async (req, res) => {
    const { pdfUrl, leadData, agentData, stepId, cacheKey, basePdfBase64 } = req.body;
    if (!pdfUrl && !stepId && !basePdfBase64) return res.status(400).json({ error: 'pdfUrl, stepId, or basePdfBase64 required' });

    // Guard: if only a stepId was given (no URL, no base64) and no PDF file exists on
    // disk for that step, return early rather than throwing inside buildPrefillPdf.
    // This prevents acknowledgement-only steps (consent-referral, mortgage-docs, etc.)
    // from erroring when they have no associated PDF.
    if (stepId && !pdfUrl && !basePdfBase64) {
      const localPath = path.join(process.cwd(), 'public', 'documents', `${stepId}.pdf`);
      if (!fs.existsSync(localPath)) {
        console.log(`[Prefill] No PDF file for stepId=${stepId} — returning empty (acknowledgement-only step)`);
        return res.json({ pdf: null, fieldsFilled: 0 });
      }
    }

    // Cache hit — return instantly, no processing needed
    if (cacheKey) {
      const cached = prefilledPdfCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < PREFILL_CACHE_TTL_MS) {
        console.log(`[Prefill] Cache HIT for ${cacheKey}`);
        return res.json({ pdf: cached.pdf, fieldsFilled: cached.fieldsFilled });
      }
    }

    // Dedup — if this exact key is already being processed, wait for that promise
    if (cacheKey && prefillInFlight.has(cacheKey)) {
      console.log(`[Prefill] Dedup HIT for ${cacheKey} — waiting for in-flight request`);
      try {
        const result = await prefillInFlight.get(cacheKey)!;
        return res.json(result);
      } catch {
        // If in-flight failed, fall through to process again
      }
    }

    const processPromise = buildPrefillPdf({ stepId, pdfUrl, basePdfBase64, leadData: leadData || {}, agentData: agentData || {} });

    // Register in-flight promise for dedup, clean up when done
    if (cacheKey) prefillInFlight.set(cacheKey, processPromise);

    try {
      const result = await processPromise;

      // Cache the result (including XFA/fallback results with fieldsFilled=0)
      if (cacheKey) {
        prefilledPdfCache.set(cacheKey, { ...result, cachedAt: Date.now() });
        console.log(`[Prefill] Cached result for ${cacheKey} (fieldsFilled=${result.fieldsFilled})`);
      }

      return res.json(result);
    } catch (error: any) {
      console.error('[Prefill] Error, returning original PDF:', error);
      try {
        const localPath = path.join(process.cwd(), 'public', 'documents', `${stepId}.pdf`);
        if (stepId && fs.existsSync(localPath)) {
          const original = fs.readFileSync(localPath);
          return res.json({ pdf: original.toString('base64'), fieldsFilled: 0 });
        }
      } catch { /* nothing we can do */ }
      res.status(500).json({ error: error.message || 'Failed to prefill PDF' });
    } finally {
      if (cacheKey) prefillInFlight.delete(cacheKey);
    }
  });

  // ── Document Signing Endpoint ──────────────────────────────────────────
  // Firestore writes are handled client-side; server only sends the notification email.
  app.post('/api/sign-document', async (req, res) => {
    const {
      leadId, stepId, signerName, signerEmail, agentEmail, agentName,
      signature, stepTitle, docLabel, signedAt: clientSignedAt,
      // ID files: base64 content only — never written to disk or DB
      idAttachments = [],
    } = req.body;

    if (!signerName || !agentEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const signedAt = clientSignedAt || new Date().toISOString();
      const resendKey = process.env.RESEND_API_KEY;
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const agentDisplayName = agentName || 'Your Agent';

      if (resendKey) {
        const resend = new Resend(resendKey);
        const signedDateStr = new Date(signedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'full', timeStyle: 'short' });

        // Build attachment list — nothing is persisted; all attachments exist only in-memory per request
        const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];

        // Signature PNG (if step required a drawn signature)
        if (signature) {
          const signatureBase64 = signature.replace(/^data:image\/png;base64,/, '');
          attachments.push({
            filename: `${(docLabel || 'document').replace(/\s+/g, '_')}_signed.png`,
            content: Buffer.from(signatureBase64, 'base64'),
            contentType: 'image/png',
          });
        }

        // PDF document — resolve the pre-filled PDF buffer from one of three sources:
        //  1. prefillPdf  — base64 sent by the client (may be empty if Storage CORS blocked the fetch)
        //  2. pdfStorageUrl — Firebase Storage URL; server fetches it directly (no CORS restrictions)
        //  3. local disk   — fallback blank form (no agent data)
        const prefillPdf: string = req.body.prefillPdf || '';
        const pdfStorageUrl: string = req.body.pdfStorageUrl || '';

        let pdfBuffer: Buffer | null = null;

        if (prefillPdf) {
          pdfBuffer = Buffer.from(prefillPdf, 'base64');
          console.log(`[Sign] Using client prefillPdf (${pdfBuffer.length} bytes)`);
        } else if (pdfStorageUrl && pdfStorageUrl.startsWith('https://')) {
          // Browser couldn't fetch from Storage (CORS). Server has no CORS restriction — fetch directly.
          try {
            const storageRes = await fetch(pdfStorageUrl);
            if (storageRes.ok) {
              pdfBuffer = Buffer.from(await storageRes.arrayBuffer());
              console.log(`[Sign] Fetched pre-filled PDF from Storage URL (${pdfBuffer.length} bytes)`);
            } else {
              console.warn(`[Sign] Storage URL fetch returned ${storageRes.status}`);
            }
          } catch (fetchErr: any) {
            console.warn('[Sign] Could not fetch PDF from Storage URL:', fetchErr.message);
          }
        }

        if (pdfBuffer) {
          // Embed buyer signature and initials into the PDF
          if (signature || req.body.initialsDataUrl) {
            try {
              const { PDFDocument } = await import('pdf-lib');
              const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
              const pages = pdfDoc.getPages();
              const form = pdfDoc.getForm();
              const allFields = form.getFields();

              const sigBase64 = signature ? signature.replace(/^data:image\/png;base64,/, '') : null;
              const sigImage = sigBase64 ? await pdfDoc.embedPng(Buffer.from(sigBase64, 'base64')) : null;

              const buyerInitialsRaw: string = req.body.initialsDataUrl || '';
              const initBase64 = buyerInitialsRaw ? buyerInitialsRaw.replace(/^data:image\/png;base64,/, '') : null;
              const initImage = initBase64 ? await pdfDoc.embedPng(Buffer.from(initBase64, 'base64')) : null;

              if (stepId === 'bra') {
                // ── BRA flat PDF (OREA Form 300) ──────────────────────────────────────
                // Each page: buyer initials → RIGHT oval "INITIALS OF BUYER(S):" (~68% from left, ~4% from bottom)
                //            Agent initials are already in the LEFT oval "INITIALS OF BROKERAGE:"
                // Page 3:    Agent sig at ~62% from top (y=0.38); buyer sig below at ~71% from top (y=0.29)
                if (initImage) {
                  for (const pg of pages) {
                    const { width: pw, height: ph } = pg.getSize();
                    const dims = initImage.scaleToFit(50, 25);
                    // "INITIALS OF BUYER(S):" oval — RIGHT side, very bottom of each page
                    pg.drawImage(initImage, { x: pw * 0.68, y: ph * 0.04, width: dims.width, height: dims.height });
                  }
                  console.log(`[Sign] Buyer initials embedded on all ${pages.length} BRA pages (right oval)`);
                }

                if (sigImage && pages.length >= 3) {
                  const p3 = pages[2];
                  const { width: pw3, height: ph3 } = p3.getSize();
                  const dims = sigImage.scaleToFit(150, 35);
                  // "SIGNED, SEALED AND DELIVERED" buyer sig line — ~71% from top = 29% from bottom
                  p3.drawImage(sigImage, { x: pw3 * 0.05, y: ph3 * 0.29, width: dims.width, height: dims.height });
                  console.log('[Sign] Buyer signature embedded on BRA page 3 at y=29%');
                }
              } else {
                // ── Other documents — try AcroForm field, then last-page fallback ────
                let placed = false;
                if (sigImage) {
                  for (const field of allFields) {
                    const name = field.getName().toLowerCase();
                    const isBuyerSig =
                      (name.includes('buyer') || name.includes('client') || name.includes('signer')) &&
                      (name.includes('sig') || name.includes('signature'));
                    if (!isBuyerSig) continue;
                    const widgets = (field as any).acroField.getWidgets();
                    if (!widgets.length) continue;
                    const rect = widgets[0].getRectangle();
                    const dims = sigImage.scaleToFit(Math.max(rect.width - 6, 10), Math.max(rect.height - 6, 10));
                    pages[pages.length - 1].drawImage(sigImage, {
                      x: rect.x + 3,
                      y: rect.y + (rect.height - dims.height) / 2,
                      width: dims.width, height: dims.height,
                    });
                    placed = true;
                    break;
                  }
                  if (!placed) {
                    const targetPage = pages[pages.length - 1];
                    const dims = sigImage.scaleToFit(150, 45);
                    targetPage.drawImage(sigImage, { x: 52, y: 148, width: dims.width, height: dims.height });
                    console.log(`[Sign] Signature placed at generic fallback position`);
                  }
                }
              }

              try { form.flatten(); } catch { /* ignore — already drawn */ }
              pdfBuffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
              console.log(`[Sign] Signatures embedded in PDF for stepId=${stepId}`);
            } catch (embedErr) {
              console.warn('[Sign] Could not embed signatures in PDF:', embedErr);
            }
          }

          attachments.push({
            filename: `${(docLabel || stepId || 'document').replace(/\s+/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
          console.log(`[Sign] Attaching pre-filled PDF (${pdfBuffer.length} bytes) for stepId=${stepId}`);
        } else if (stepId) {
          const pdfPath = path.join(process.cwd(), 'public', 'documents', `${stepId}.pdf`);
          if (fs.existsSync(pdfPath)) {
            attachments.push({
              filename: `${(docLabel || stepId).replace(/\s+/g, '_')}.pdf`,
              content: fs.readFileSync(pdfPath),
              contentType: 'application/pdf',
            });
            console.log(`[Sign] Attaching default PDF: ${pdfPath}`);
          }
        }

        // ID documents — decoded from base64, attached to emails, never written to disk/DB
        for (const idFile of idAttachments) {
          if (idFile.content && idFile.filename) {
            attachments.push({
              filename: idFile.filename,
              content: Buffer.from(idFile.content, 'base64'),
              contentType: idFile.mimeType || 'application/octet-stream',
            });
          }
        }
        const hasIdFiles = idAttachments.length > 0;
        const isMortgageDocs = stepId === 'mortgage-docs';
        const isFintrac = stepId === 'fintrac';

        const signatureBase64 = signature ? signature.replace(/^data:image\/png;base64,/, '') : null;

        // Label shown in the details table for the submitter row
        const submitterLabel = (isFintrac || isMortgageDocs) ? 'Submitted by' : 'Signed by';
        const timeLabel = (isFintrac || isMortgageDocs) ? 'Submitted at' : 'Signed at';
        const filesLabel = isMortgageDocs ? 'Documents' : 'ID Files';

        const detailsTable = `
          <div style="background: #f9f9f9; border: 1px solid #e4e4e7; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="color: #888; padding: 5px 0; width: 140px;">Document</td><td style="font-weight: 700;">${stepTitle}</td></tr>
              <tr><td style="color: #888; padding: 5px 0;">Form / Label</td><td style="font-weight: 700;">${docLabel}</td></tr>
              <tr><td style="color: #888; padding: 5px 0;">${submitterLabel}</td><td style="font-weight: 700;">${signerName}</td></tr>
              <tr><td style="color: #888; padding: 5px 0;">Email</td><td style="font-weight: 700;">${signerEmail || '—'}</td></tr>
              <tr><td style="color: #888; padding: 5px 0;">${timeLabel}</td><td style="font-weight: 700;">${signedDateStr} (Toronto)</td></tr>
              ${hasIdFiles ? `<tr><td style="color: #888; padding: 5px 0;">${filesLabel}</td><td style="font-weight: 700; color: #D4A373;">${idAttachments.length} file(s) attached</td></tr>` : ''}
            </table>
          </div>`;
        const signatureBlock = signatureBase64 ? `
          <p style="font-size: 14px; font-weight: 700; margin: 0 0 12px;">Electronic Signature:</p>
          <div style="border: 2px solid #e4e4e7; border-radius: 10px; padding: 20px; background: #fafafa; text-align: center; margin-bottom: 8px;">
            <img src="data:image/png;base64,${signatureBase64}" alt="Signature of ${signerName}" style="max-width: 100%; max-height: 120px;" />
          </div>
          <p style="font-size: 11px; color: #aaa; margin: 0 0 28px; text-align: center;">Signature of ${signerName} — ${signedDateStr}</p>` : '';

        const idNotice = hasIdFiles ? (isMortgageDocs ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 13px; font-weight: 700; color: #15803d; margin: 0 0 6px;">📄 Mortgage Documents Attached</p>
            <p style="font-size: 12px; color: #166534; margin: 0;">The lead's mortgage documents (${idAttachments.length} file(s)) are attached to this email. These files were not stored in LeadCrest.</p>
          </div>` : `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 13px; font-weight: 700; color: #1e40af; margin: 0 0 6px;">🪪 ID Documents Attached</p>
            <p style="font-size: 12px; color: #1e3a8a; margin: 0;">The lead's government-issued ID (${idAttachments.length} file(s)) is attached to this email. These files were not stored in LeadCrest.</p>
          </div>`) : '';

        const leadSubject = isMortgageDocs
          ? `Your mortgage documents have been submitted`
          : isFintrac
          ? `Your FINTRAC verification has been submitted`
          : `Your signed copy: "${stepTitle}"`;
        const leadIntro = isMortgageDocs
          ? `This confirms that your mortgage documents have been securely forwarded to your agent. Your files are attached to this email for your records.`
          : isFintrac
          ? `This confirms that your identity documents have been securely forwarded to your agent for FINTRAC verification purposes. Your ID files are attached to this email for your records.`
          : `This is your confirmation that you have successfully signed the following document. Your signed copy is attached to this email.`;

        // Email 1: TO lead — confirmation copy (no dashboard link, ID not re-stored)
        if (signerEmail) {
          await resend.emails.send({
            from: 'LeadCrest <notifications@leistly.com>',
            to: signerEmail,
            subject: leadSubject,
            attachments,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #2d2d2d; background: #f5f0eb; padding: 32px 16px;">
                <div style="background: #1E3A5F; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 900;">LEADCREST</h1>
                  <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">${isMortgageDocs ? 'Mortgage Document Submission Confirmation' : isFintrac ? 'FINTRAC Verification Confirmation' : 'Signed Document Confirmation'}</p>
                </div>
                <div style="background: #fff; padding: 32px; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="font-size: 16px; margin: 0 0 8px;">Hi ${signerName?.split(' ')[0] || signerName},</p>
                  <p style="font-size: 14px; color: #666; margin: 0 0 24px;">${leadIntro}</p>
                  ${detailsTable}
                  ${signatureBlock}
                  <p style="font-size: 11px; color: #ccc; margin-top: 16px;">Sent by LeadCrest · Electronic Commerce Act (Ontario) · Keep this email for your records.</p>
                </div>
              </div>`,
          });
        }

        // Email 2: TO agent — all attachments including ID (email-only, not stored server-side)
        const agentSubject = isMortgageDocs
          ? `📄 ${signerName} submitted mortgage documents`
          : isFintrac
          ? `🪪 ${signerName} submitted ID for FINTRAC verification`
          : `✍️ ${signerName} signed "${stepTitle}"`;
        const agentHeaderLabel = isMortgageDocs ? 'Mortgage Documents Received' : isFintrac ? 'FINTRAC ID Received' : 'Document Signed';
        const agentIntro = isMortgageDocs
          ? `<strong>${signerName}</strong> has submitted their mortgage documents. The file(s) are attached to this email only — they are not stored in LeadCrest.`
          : isFintrac
          ? `<strong>${signerName}</strong> has submitted their government-issued ID for FINTRAC identity verification. The ID file(s) are attached to this email only — they are not stored in LeadCrest.`
          : `<strong>${signerName}</strong> has reviewed and signed the following document. A confirmation copy has been sent to them at ${signerEmail || 'their email'}.`;
        await resend.emails.send({
          from: 'LeadCrest <notifications@leistly.com>',
          to: agentEmail,
          subject: agentSubject,
          attachments,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #2d2d2d; background: #f5f0eb; padding: 32px 16px;">
              <div style="background: #1E3A5F; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 900;">LEADCREST</h1>
                <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">${agentHeaderLabel}</p>
              </div>
              <div style="background: #fff; padding: 32px; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; margin: 0 0 8px;">Hi ${agentDisplayName},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">
                  ${agentIntro}
                </p>
                ${idNotice}
                ${detailsTable}
                ${signatureBlock}
                <a href="${appUrl}/lead/${leadId}" style="display: inline-block; background: #D4A373; color: #fff; font-weight: 900; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px;">
                  View Lead in Dashboard →
                </a>
                <p style="font-size: 11px; color: #ccc; margin-top: 32px;">Sent by LeadCrest · Electronic Commerce Act (Ontario)</p>
              </div>
            </div>`,
        });

        console.log(`[Sign] Emails sent — agent: ${agentEmail}, lead: ${signerEmail}`);
      }

      res.json({ success: true, signedAt });
    } catch (error: any) {
      console.error('[Sign] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to send notification' });
    }
  });

  // Save Contacts Route (Client-side sync)
  app.post('/api/contacts/save', async (req, res) => {
    const { uid, contacts } = req.body;
    if (!uid || !contacts) return res.status(400).json({ error: 'Missing UID or contacts' });

    try {
      if (!adminDb) throw new Error('Firebase Admin not initialized');

      const batch = adminDb.batch();
      const contactsCol = adminDb.collection('users').doc(uid).collection('contacts');

      // Clear existing contacts or just update?
      // For simplicity, we'll just set/merge them.
      for (const conn of contacts) {
        const contactId = conn.resourceName?.split('/')[1] || `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const contactData = {
          resourceName: conn.resourceName,
          etag: conn.etag,
          name: conn.names?.[0]?.displayName || 'Unnamed',
          email: conn.emailAddresses?.[0]?.value || '',
          phone: conn.phoneNumbers?.[0]?.value || '',
          photoUrl: conn.photos?.[0]?.url || '',
          syncedAt: FieldValue.serverTimestamp()
        };

        batch.set(contactsCol.doc(contactId), contactData, { merge: true });
      }

      await batch.commit();

      const lastSyncAt = new Date().toISOString();
      await adminDb.collection('agents').doc(uid).update({
        googleContacts: contacts,
        lastSyncAt
      });

      res.json({ success: true, count: contacts.length, lastSyncAt });
    } catch (error: any) {
      console.error('Save Contacts Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Disconnect Google Contacts
  app.post('/api/auth/google/disconnect', async (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'Missing UID' });

    try {
      if (!adminDb) throw new Error('Firebase Admin not initialized');

      // Update agent profile
      await adminDb.collection('agents').doc(uid).update({
        googleContactsConnected: false,
        googleEmail: '',
        googleContacts: FieldValue.delete(),
        lastSyncAt: FieldValue.delete()
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Disconnect Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Email automation endpoint
  app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        return res.status(500).json({ error: 'Email service not configured' });
      }

      const resend = new Resend(resendKey);
      const result = await resend.emails.send({
        from: 'LeadCrest <notifications@leistly.com>',
        to,
        subject,
        html,
        text: text || subject
      });

      res.json({ success: true, id: result.data?.id });
    } catch (error: any) {
      console.error('[Email Error]:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    const { message, agentId, history } = req.body;
    console.log(`[Simulator Chat] agentId: ${agentId}`);

    try {
      const { db } = await import('./src/firebase');
      const { collection, addDoc } = await import('firebase/firestore');

      const ai = getAI();

      const systemPrompt = `You are a friendly, professional real estate AI assistant. Qualify this lead by asking ONE question at a time in this exact order:
1. Full name
2. Email address
3. Phone number
4. Current home address
5. Are they looking to Buy or Rent?
6. What is their timeline? (options: ASAP, 1-3 months, 3-6 months, 6-12 months, Just exploring)
7. What is their budget or price range?
8. Have they been pre-approved for a mortgage? (options: Yes, In process, Not yet) — skip this for renters, ask about monthly budget instead
9. Do they have a down payment ready? (options: Yes 20%+, Yes less than 20%, Financing entirely, Not yet) — skip for renters
10. Which neighbourhood or area are they interested in?
11. What is their motivation for moving? (options: Relocating/job change, Upgrading/downsizing, Investment, Just exploring)
12. Who is their current employer?
13. What is their approximate annual salary or household income?

Rules:
- Ask ONLY ONE question at a time, keep responses short and friendly
- Once you have all 13 answers, thank them warmly and output EXACTLY this tag (no extra text after):
[QUALIFIED: {"name":"...","email":"...","phone":"...","currentAddress":"...","type":"buy or rent","timeline":"...","budget":"...","preApproved":"...","downPaymentReady":"...","locationPreference":"...","motivation":"...","employer":"...","salary":"..."}]`;

      const contents = (history || []).filter((m: any) => m.role === 'user' || m.role === 'model');
      contents.push({ role: 'user', parts: [{ text: message }] });

      const result = await generateWithFallback(ai, {
        contents,
        config: { systemInstruction: systemPrompt },
      });

      let aiText = result.text || "I'm here to help!";
      let leadCaptured = false;

      if (aiText.includes('[QUALIFIED:')) {
        const match = aiText.match(/\[QUALIFIED:\s*({[\s\S]*?})\]/);
        if (match) {
          try {
            const leadData = JSON.parse(match[1]);

            // Score the lead using the same logic as /api/score-lead
            const scoreRes = await fetch(`http://localhost:3000/api/score-lead`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(leadData)
            });
            const { score } = await scoreRes.json();

            const status = score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold';

            await addDoc(collection(db, 'leads'), {
              agentId: agentId || null,
              name: leadData.name || '',
              email: leadData.email || '',
              phone: leadData.phone || '',
              currentAddress: leadData.currentAddress || '',
              type: (leadData.type || 'buy').toLowerCase().includes('rent') ? 'rent' : 'buy',
              timeline: leadData.timeline || '',
              budget: leadData.budget || '',
              preApproved: leadData.preApproved || '',
              downPaymentReady: leadData.downPaymentReady || '',
              locationPreference: leadData.locationPreference || '',
              motivation: leadData.motivation || '',
              employmentInfo: {
                company: leadData.employer || '',
                salary: leadData.salary || '',
                validated: false,
              },
              score,
              status,
              source: 'whatsapp-simulator',
              createdAt: new Date().toISOString(),
            });

            leadCaptured = true;
            console.log(`[Chat] Lead saved — score: ${score}, status: ${status}`);
          } catch (e) {
            console.error('[Chat] Failed to save lead:', e);
          }
          aiText = aiText.replace(/\[QUALIFIED:[\s\S]*?\]/g, '').trim() +
            "\n\nThank you! Your profile has been captured and shared with your agent. They'll be in touch shortly! 🏡";
        }
      }

      res.json({ reply: aiText.replace(/\[QUALIFIED:[\s\S]*?\]/g, '').trim(), leadCaptured });
    } catch (error) {
      console.error('[Simulator Error]:', error);
      res.status(500).json({ error: 'Failed to process chat' });
    }
  });

  // 3. REACHABILITY TESTS
  app.all('/api/v1/test-reachability', (req, res) => {
    res.json({ status: 'ok', method: req.method, url: req.url });
  });

  // Root handler - no special Twilio handling needed (web-only approach)

  // 5. Basic Middlewares & CORS (Already handled at top)
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.get('/api/ping', (req, res) => {
    res.status(200).send('pong');
  });

  console.log(`[Server] Current working directory: ${process.cwd()}`);
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[Server] GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);

  // API for lead scoring (0-100)
  app.get('/api/test', (req, res) => {
    console.log('[API Test] GET /api/test reached');
    res.json({ status: 'ok', message: 'API is reachable', timestamp: new Date().toISOString() });
  });

  app.post('/api/score-lead', (req, res) => {
    const { name, email, phone, currentAddress, timeline, preApproved, budget, downPaymentReady, locationPreference, motivation, salary } = req.body;

    let score = 0;

    // Contact completeness (max 10)
    if (name) score += 2;
    if (email) score += 3;
    if (phone) score += 3;
    if (currentAddress) score += 2;

    // Timeline urgency (max 25)
    const tl = (timeline || '').toLowerCase();
    if (tl.includes('asap') || tl.includes('now') || tl.includes('immediately')) score += 25;
    else if (tl.includes('1-3') || tl.includes('1 to 3')) score += 18;
    else if (tl.includes('3-6') || tl.includes('3 to 6') || tl.includes('6') || tl.includes('soon')) score += 10;
    else if (tl.includes('year') || tl.includes('12') || tl.includes('looking')) score += 3;

    // Pre-approval status (max 20)
    const pa = (preApproved || '').toLowerCase();
    if (pa.includes('yes') || pa.includes('approved')) score += 20;
    else if (pa.includes('process') || pa.includes('qualified')) score += 12;
    else if (pa.includes('no') || pa.includes('not')) score += 4;

    // Budget specificity (max 18)
    if (budget && budget.length > 3) {
      const hasDollarOrNumber = /[\$\d]/.test(budget);
      score += hasDollarOrNumber ? 18 : 10;
    }

    // Down payment (max 15)
    const dp = (downPaymentReady || '').toLowerCase();
    if (dp.includes('20') || (dp.includes('yes') && dp.includes('more'))) score += 15;
    else if (dp.includes('yes') || dp.includes('ready')) score += 10;
    else if (dp.includes('financ') || dp.includes('entirely')) score += 4;

    // Location specificity (max 8)
    if (locationPreference && locationPreference.length > 3) score += 8;

    // Motivation urgency (max 7)
    const mot = (motivation || '').toLowerCase();
    if (mot.includes('relocat') || mot.includes('job')) score += 7;
    else if (mot.includes('upgrad') || mot.includes('growing')) score += 6;
    else if (mot.includes('invest')) score += 5;
    else if (mot.includes('explor') || mot.includes('just')) score += 1;

    // Income bonus (max 5 extra)
    const salaryNum = parseInt((salary || '0').replace(/[^0-9]/g, ''));
    if (salaryNum >= 150000) score += 5;
    else if (salaryNum >= 100000) score += 3;
    else if (salaryNum >= 60000) score += 1;

    res.json({ score: Math.min(score, 100) });
  });

  // Debug endpoint to check lead count
  app.get('/api/debug/leads-count', async (req, res) => {
    try {
      const { db } = await import('./src/firebase');
      const { getDocs, collection } = await import('firebase/firestore');
      const snapshot = await getDocs(collection(db, 'leads'));
      res.json({ count: snapshot.size });
    } catch (error) {
      console.error('[Debug] Error fetching lead count:', error);
      res.status(500).json({ error: 'Failed to fetch lead count' });
    }
  });

  // Debugging routes
  app.get('/api/hello', (req, res) => {
    console.log('[Debug] GET /api/hello reached');
    res.send('Hello from Express!');
  });

  // Catch-all for unmatched API routes
  app.all('/api/*', (req, res) => {
    console.log(`[API 404] Unmatched ${req.method} request for ${req.url}`);
    res.status(404).json({
      error: 'API route not found',
      method: req.method,
      url: req.url,
      registeredRoutes: [
        '/api/health',
        '/api/auth/google/disconnect',
        '/api/chat',
        '/api/hello',
        '/api/contacts/save'
      ]
    });
  });

// Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Starting Vite in development mode...');
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Server] Vite middleware attached');
    } catch (e) {
      console.error('[Server] Failed to load Vite middleware:', e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error Handler]', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  // Start listening AT THE END
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Server is now listening on http://0.0.0.0:${PORT}`);
    console.log('[Server] All routes registered.');
  });
}

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
