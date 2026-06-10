import { Layers, Image, Minimize2, Cloud, LogOut } from 'lucide-react';

interface HeaderProps {
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  isConnecting?: boolean;
  isIframe?: boolean;
}

export default function Header({ user, onLogin, onLogout, isConnecting = false, isIframe = false }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                Twibon<span className="text-indigo-600">Studio</span> <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-150">Rasio 4:5</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">Pembuat Twibbon Instan Tanpa Watermark</p>
            </div>
          </div>

          {/* Right Action Section */}
          <div className="flex items-center space-x-4">
            {/* Quick specs banner */}
            <div className="hidden lg:flex items-center space-x-6 text-xs text-slate-600 mr-2">
              <div className="flex items-center space-x-1.5">
                <Minimize2 className="w-4 h-4 text-indigo-600" />
                <span>Format Instagram Portrait</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Image className="w-4 h-4 text-indigo-600" />
                <span>Ekspor HD (1080 × 1350)</span>
              </div>
            </div>

            {/* Google Authentication Actions */}
            {user ? (
              <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 p-1.5 pr-3 rounded-full">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-indigo-200"
                  />
                ) : (
                  <div className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="text-left hidden sm:block mr-2">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Drive Connected</p>
                  <p className="text-xs font-bold text-indigo-900 truncate max-w-[120px] mt-0.5 leading-none">{user.displayName}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1 text-indigo-600 hover:text-rose-600 rounded-full hover:bg-indigo-100/50 transition-all"
                  title="Keluar Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                disabled={isConnecting}
                className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3.5 rounded-full transition-all duration-200 shadow-md shadow-indigo-650/10 pointer-events-auto"
              >
                <Cloud className="w-3.5 h-3.5 fill-current" />
                <span>{isConnecting ? 'Menghubungkan...' : isIframe ? 'Sambung Drive (Tab Baru)' : 'Sambung Google Drive'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
