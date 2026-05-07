import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import LeadsDashboard from './pages/LeadsDashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Pricing from './pages/Pricing';
import Onboarding from './pages/Onboarding';
import LicenseValidationSplash from './pages/LicenseValidationSplash';
import Profile from './pages/Profile';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LeadDetails from './pages/LeadDetails';
import AdminDashboard from './pages/AdminDashboard';
import AdminAgentDetails from './pages/AdminAgentDetails';
import AdminLogin from './pages/AdminLogin';
import CustomerChat from './pages/CustomerChat';
import SignDocument from './pages/SignDocument';
import Contacts from './pages/Contacts';
import Navbar from './components/Navbar';
import { ModalProvider } from './contexts/ModalContext';
import GlobalModals from './components/GlobalModals';
import { Agent } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function ProtectedRoute({ children, user, loading }: { children: React.ReactNode, user: User | null, loading: boolean }) {
  const [agentData, setAgentData] = useState<Agent | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const location = useLocation();

  useEffect(() => {
    console.log('[ProtectedRoute] Checking access for user:', user?.uid, 'loading:', loading);
    
    // Safety timeout for onboarding check
    const timer = setTimeout(() => {
      if (checkingOnboarding) {
        console.warn('[ProtectedRoute] Onboarding check timed out. Proceeding.');
        setCheckingOnboarding(false);
      }
    }, 3000);

    if (user) {
      const fetchAgent = async () => {
        try {
          const path = `agents/${user.uid}`;
          let agentDoc;
          try {
            agentDoc = await getDoc(doc(db, 'agents', user.uid));
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, path);
          }
          
          if (agentDoc && agentDoc.exists()) {
            setAgentData(agentDoc.data() as Agent);
          }
        } catch (err) {
          console.error('[ProtectedRoute] Error fetching agent data:', err);
        } finally {
          setCheckingOnboarding(false);
          clearTimeout(timer);
        }
      };
      fetchAgent();
    } else {
      setCheckingOnboarding(false);
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [user, loading]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honey"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!agentData && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (agentData && !agentData.isOnboarded && location.pathname !== '/onboarding' && location.pathname !== '/license-splash') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-linen p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-midnight mb-2">Something went wrong</h2>
            <p className="text-charcoal/60 mb-6">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-honey text-midnight font-black rounded-xl hover:bg-honey/90 transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 text-left p-4 bg-gray-50 rounded-lg overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-500">{this.state.error?.toString()}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('[App] Rendering, loading:', loading);

  useEffect(() => {
    console.log('[App] Mounting effect');
    // Safety timeout: if auth state doesn't resolve in 3 seconds, 
    // force loading to false so the app can at least try to render.
    const timer = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('[App] Auth state check timed out. Forcing app to load.');
          return false;
        }
        return prev;
      });
    }, 3000);

    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('[App] Auth state changed, user:', user?.email || 'null');
        setUser(user);
        setLoading(false);
      }, (error) => {
        console.error('[App] onAuthStateChanged error:', error);
        setLoading(false);
      });
      return () => {
        console.log('[App] Unmounting effect');
        unsubscribe();
        clearTimeout(timer);
      };
    } catch (err) {
      console.error('[App] Error setting up auth listener:', err);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-honey"></div>
      </div>
    );
  }

  return (
    <Router>
      <ModalProvider>
        <div className="min-h-screen bg-linen text-charcoal font-sans selection:bg-honey/30 selection:text-midnight">
          <Navbar user={user} />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
              <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
              <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
              <Route path="/pricing" element={user ? <Pricing /> : <Navigate to="/login" />} />
              <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/login" />} />
              <Route path="/license-splash" element={user ? <LicenseValidationSplash /> : <Navigate to="/login" />} />
              
              <Route path="/chat/:agentId" element={<CustomerChat />} />
              <Route path="/sign/:leadId/:stepId" element={<SignDocument />} />
              
              <Route path="/dashboard" element={
                <ProtectedRoute user={user} loading={loading}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/leads" element={
                <ProtectedRoute user={user} loading={loading}>
                  <LeadsDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/lead/:id" element={
                <ProtectedRoute user={user} loading={loading}>
                  <LeadDetails />
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute user={user} loading={loading}>
                  <Profile />
                </ProtectedRoute>
              } />
              
              <Route path="/contacts" element={
                <ProtectedRoute user={user} loading={loading}>
                  <Contacts />
                </ProtectedRoute>
              } />
              
              <Route path="/privacy" element={<PrivacyPolicy />} />

              <Route path="/admin" element={
                user?.email === 'admin@leistly.com' ? (
                  <AdminDashboard />
                ) : (
                  <Navigate to="/" />
                )
              } />
              <Route path="/admin/agent/:id" element={
                user?.email === 'admin@leistly.com' ? (
                  <AdminAgentDetails />
                ) : (
                  <Navigate to="/" />
                )
              } />
              <Route path="/admin/login" element={<AdminLogin />} />
            </Routes>
          </main>
          <GlobalModals />
        </div>
      </ModalProvider>
    </Router>
  );
}
