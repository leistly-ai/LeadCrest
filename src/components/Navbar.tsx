import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { LogOut, LayoutDashboard, ChevronUp, Network, QrCode, User, ShieldCheck, Users, CreditCard, Mail } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export default function Navbar({ user }: { user: FirebaseUser | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const scrollToTop = (e: React.MouseEvent) => {
    // Only scroll if clicking the background or non-interactive element
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('container')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isChatPage = location.pathname.startsWith('/chat/')
  || location.pathname.startsWith('/sign/')
  || location.pathname.startsWith('/fintrac/');

  if (isChatPage) {
    return (
      <nav className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <ChevronUp className="w-7 h-7 text-honey absolute -top-1" strokeWidth={3} />
              <Network className="w-5 h-5 text-honey/60 absolute bottom-0" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-black tracking-tighter text-midnight leading-none">LEADCREST</span>
              <span className="text-[9px] font-bold text-honey uppercase tracking-[0.2em] mt-0.5">Engaged Intelligence</span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      onClick={scrollToTop}
      className="bg-white border-b border-zinc-100 sticky top-0 z-50 cursor-pointer"
    >
      <div className="container mx-auto px-6 h-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 group pointer-events-auto">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              {/* Data Apex Symbol: Minimalist, upward-moving geometric chevron network line */}
              <div className="relative w-10 h-10 flex items-center justify-center">
                <ChevronUp className="w-8 h-8 text-honey absolute -top-1" strokeWidth={3} />
                <Network className="w-6 h-6 text-honey/60 absolute bottom-0" strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black tracking-tighter text-midnight leading-none">LEADCREST</span>
              <span className="text-[10px] font-bold text-honey uppercase tracking-[0.2em] mt-1">Engaged Intelligence</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        {!user && (
          <div className="hidden lg:flex items-center gap-8 pointer-events-auto">
            <button onClick={() => scrollToSection('features')} className="text-xs font-bold text-midnight/60 hover:text-honey uppercase tracking-widest transition-colors">Features</button>
            <button onClick={() => scrollToSection('pricing')} className="text-xs font-bold text-midnight/60 hover:text-honey uppercase tracking-widest transition-colors">Pricing</button>
            <button onClick={() => openModal('integrations')} className="text-xs font-bold text-midnight/60 hover:text-honey uppercase tracking-widest transition-colors">Integrations</button>
            <button onClick={() => openModal('about')} className="text-xs font-bold text-midnight/60 hover:text-honey uppercase tracking-widest transition-colors">About Us</button>
          </div>
        )}

        <div className="flex items-center gap-8 pointer-events-auto">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/dashboard' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
              >
                <QrCode className="w-4 h-4" /> Agent Tools
              </Link>
              <Link
                to="/leads"
                className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/leads' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
              >
                <LayoutDashboard className="w-4 h-4" /> Leads
              </Link>
              <Link
                to="/contacts"
                className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/contacts' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
              >
                <Users className="w-4 h-4" /> Contacts
              </Link>
              <Link
                to="/usage"
                className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/usage' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
              >
                <CreditCard className="w-4 h-4" /> Usage
              </Link>
              <Link
                to="/emails"
                className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/emails' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
              >
                <Mail className="w-4 h-4" /> Emails
              </Link>
              <Link
                to="/profile"
                className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/profile' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
              >
                <User className="w-4 h-4" /> Profile
              </Link>
              {user.email === 'admin@leistly.com' && (
                <Link
                  to="/admin"
                  className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === '/admin' ? 'text-honey' : 'text-midnight/70 hover:text-honey'}`}
                >
                  <ShieldCheck className="w-4 h-4" /> Admin
                </Link>
              )}
              <div className="h-6 w-px bg-zinc-100" />
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-midnight">{user.displayName}</p>
                  <p className="text-[9px] text-honey font-bold uppercase tracking-widest">Licensed Professional</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-full hover:bg-linen text-midnight/40 hover:text-honey transition-all"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-bold text-midnight/70 hover:text-honey transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="btn-primary"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
