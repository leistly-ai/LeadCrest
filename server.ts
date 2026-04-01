import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Use fs to read JSON to avoid ESM import issues with JSON modules
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

let adminDb: any = null;

console.log('Starting server.ts...');

// In-memory session store
const sessions = new Map<string, any>();
const lastRequests: any[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log('[Server] Starting server in isolation mode...');

  // 1. BODY PARSERS (Must be BEFORE routes that use req.body)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Firebase Admin inside startServer and wrap in try-catch
  try {
    console.log('[Firebase Admin] Initializing with config:', JSON.stringify({
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    }));
    
    let app;
    if (getApps().length === 0) {
      app = initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('[Firebase Admin] Initialized successfully');
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

  // 3. WEBHOOK HANDLER DEFINITION
  const webhookHandler = async (req: any, res: any) => {
    const method = req.method;
    const url = req.originalUrl || req.url;
    console.log(`[Webhook Execution] ${method} ${url}`);
    
    res.type('text/xml');
    
    const From = req.query.From || req.body?.From;
    const Body = req.query.Body || req.body?.Body;

    if (method === 'GET' && !From) {
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Service Online</Message></Response>');
    }

    try {
      if (!From || !Body) {
        console.log('[Webhook] Missing From or Body', { From, Body });
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Ready</Message></Response>');
      }

      // Lazy load dependencies to keep response fast
      const { db } = await import('./src/firebase');
      const { getDocs, collection, addDoc, query, where } = await import('firebase/firestore');
      
      const now = Date.now();
      let session = sessions.get(From);
      
      if (!session) {
        let agentId = null;
        let agentName = 'Real Estate Agent';
        
        const refMatch = Body.match(/\[Ref:(.*?)\]/);
        if (refMatch) {
          const refValue = refMatch[1].trim();
          const agentsRef = collection(db, 'agents');
          const qName = query(agentsRef, where('name', '==', refValue));
          const qId = query(agentsRef, where('uid', '==', refValue));
          const [nameSnap, idSnap] = await Promise.all([getDocs(qName), getDocs(qId)]);
          const agentDoc = nameSnap.docs[0] || idSnap.docs[0];
          if (agentDoc) {
            agentId = agentDoc.id;
            agentName = agentDoc.data().name;
          }
        }

        if (!agentId) {
          const allAgents = await getDocs(collection(db, 'agents'));
          if (allAgents.size === 1) {
            agentId = allAgents.docs[0].id;
            agentName = allAgents.docs[0].data().name;
          }
        }

        const systemPrompt = `You are a professional real estate assistant for ${agentName}. Qualify this lead by asking: Name, Email, Phone, Address, Buy/Rent, Employer, Salary. Ask ONE question at a time. Output JSON [QUALIFIED: {...}] at the end.`;

        session = {
          agentId,
          agentName,
          history: [{ role: 'system', parts: [{ text: systemPrompt }] }],
          lastActive: now
        };
        sessions.set(From, session);
      }

      session.lastActive = now;
      session.history.push({ role: 'user', parts: [{ text: Body }] });

      const ai = getAI();
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: session.history,
      });

      let aiText = result.text || "I'm sorry, I'm having trouble right now.";

      if (aiText.includes('[QUALIFIED:')) {
        try {
          const match = aiText.match(/\[QUALIFIED:\s*({.*?})\]/s);
          if (match) {
            const leadData = JSON.parse(match[1]);
            await addDoc(collection(db, 'leads'), {
              ...leadData,
              agentId: session.agentId,
              phone: From.replace('whatsapp:', ''),
              status: 'warm',
              source: 'whatsapp',
              createdAt: new Date().toISOString()
            });
            aiText = aiText.replace(/\[QUALIFIED:.*?\]/gs, '').trim() + "\n\nThank you! I've shared your profile with the agent.";
          }
        } catch (e) {}
      }

      const cleanText = aiText.replace(/\[QUALIFIED:.*?\]/gs, '').trim();
      session.history.push({ role: 'model', parts: [{ text: cleanText }] });

      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${cleanText}</Message></Response>`);

    } catch (error: any) {
      console.error('[Webhook Error]:', error);
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error</Message></Response>');
    }
  };

  // 4. WEBHOOK ROUTES
  app.all('/whatsapp-webhook', webhookHandler);
  app.all('/twilio-webhook', webhookHandler);

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

  app.post('/api/chat', async (req, res) => {
    const { message, from, history } = req.body;
    console.log(`[Simulator Chat] From: ${from}`);

    try {
      const { db } = await import('./src/firebase');
      const { getDocs, collection, addDoc } = await import('firebase/firestore');
      
      const ai = getAI();
      
      // Use the same system prompt logic as the webhook
      const systemPrompt = "You are a professional real estate assistant. Qualify this lead by asking: Name, Email, Phone, Address, Buy/Rent, Employer, Salary. Ask ONE question at a time. Output JSON [QUALIFIED: {...}] at the end.";
      
      const fullHistory = [
        { role: 'system', parts: [{ text: systemPrompt }] },
        ...(history || [])
      ];

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: fullHistory,
      });

      let aiText = result.text || "I'm here to help!";

      // Handle qualification logic (same as webhook)
      if (aiText.includes('[QUALIFIED:')) {
        const match = aiText.match(/\[QUALIFIED:\s*({.*?})\]/s);
        if (match) {
          const leadData = JSON.parse(match[1]);
          await addDoc(collection(db, 'leads'), {
            ...leadData,
            status: 'warm',
            source: 'simulator',
            createdAt: new Date().toISOString()
          });
          aiText = aiText.replace(/\[QUALIFIED:.*?\]/gs, '').trim() + "\n\n(Lead Captured in Dashboard!)";
        }
      }

      res.json({ reply: aiText.replace(/\[QUALIFIED:.*?\]/gs, '').trim() });
    } catch (error) {
      console.error('[Simulator Error]:', error);
      res.status(500).json({ error: 'Failed to process chat' });
    }
  });

  // 3. REACHABILITY TESTS
  app.all('/api/v1/test-reachability', (req, res) => {
    res.json({ status: 'ok', method: req.method, url: req.url });
  });

  // 4. WEBHOOK ROOT SUPPORT
  app.all('/', (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isTwilio = ua.includes('Twilio') || req.query.From || req.body?.From;
    if (isTwilio) {
      return webhookHandler(req, res);
    }
    next();
  });

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

  const getAI = (keyOverride?: string) => {
    let source = 'override';
    let rawKey = keyOverride;
    
    if (!rawKey) {
      const possibleKeys = [
        { name: 'REAL_GEMINI_KEY', val: process.env.REAL_GEMINI_KEY },
        { name: 'GEMINI_API_KEY', val: process.env.GEMINI_API_KEY },
        { name: 'NEXT_PUBLIC_GEMINI_API_KEY', val: process.env.NEXT_PUBLIC_GEMINI_API_KEY },
        { name: 'GOOGLE_AI_KEY', val: process.env.GOOGLE_AI_KEY },
        { name: 'API_KEY', val: process.env.API_KEY },
        { name: 'GOOGLE_API_KEY_ALT', val: process.env.GOOGLE_API_KEY },
        { name: 'VITE_GEMINI_API_KEY', val: process.env.VITE_GEMINI_API_KEY }
      ];

      for (const k of possibleKeys) {
        if (k.val && k.val !== 'MY_GEMINI_API_KEY' && !k.val.includes('YOUR_') && k.val.length > 10) {
          rawKey = k.val;
          source = k.name;
          break;
        }
      }
      
      if (!rawKey) {
        // Fallback for error message
        rawKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        source = 'none found (showing fallback)';
      }
    }
    
    if (!rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey.includes('YOUR_')) {
      throw new Error('No valid API key found. Please go to the "Secrets" tab in AI Studio and update GEMINI_API_KEY with your actual AIza... key.');
    }
    
    // Aggressively clean the key
    const key = rawKey
      .replace(/Gemini API Key • /g, '') // Remove UI prefix if it leaked in
      .replace(/^(key|value|api_key|gemini_api_key):\s*/i, '')
      .replace(/["']/g, '')
      .replace(/[•…\s]/g, '') // Remove bullets, ellipses, and spaces
      .trim();

    if (!key.startsWith('AIza')) {
      throw new Error(`Invalid key format from ${source}. Gemini API keys must start with 'AIza'. Your current key starts with '${key.substring(0, 4)}'.`);
    }

    console.log(`[AI] Initializing with key from ${source}: ${key.substring(0, 6)}...${key.substring(key.length - 4)}`);
    
    return new GoogleGenAI({ apiKey: key });
  };

  // Helper to generate content with fallback
  const generateWithFallback = async (aiInstance: GoogleGenAI, params: any) => {
    const models = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[AI] Attempting ${modelName}...`);
        const response = await aiInstance.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        const msg = error.message || '';
        if (msg.includes('not found') || msg.includes('not supported')) {
          console.warn(`[AI] ${modelName} failed/not found, trying next...`);
          continue;
        }
        throw error; // Rethrow if it's a key or quota error
      }
    }
    throw lastError;
  };

  // API for lead scoring (0-100)
  app.get('/api/test', (req, res) => {
    console.log('[API Test] GET /api/test reached');
    res.json({ status: 'ok', message: 'API is reachable', timestamp: new Date().toISOString() });
  });

  app.post('/api/score-lead', (req, res) => {
    const { name, email, phone, currentAddress, type, salary, company } = req.body;
    
    let score = 0;
    if (name) score += 10;
    if (email) score += 10;
    if (phone) score += 10;
    if (currentAddress) score += 10;
    
    if (salary && parseInt(salary) > 50000) score += 20;
    if (company) score += 20;
    
    score += Math.floor(Math.random() * 20);
    
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
