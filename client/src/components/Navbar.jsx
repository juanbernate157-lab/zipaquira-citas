import React from 'react';
import { Calendar, QrCode, Shield, MapPin, Zap, Sparkles } from 'lucide-react';

export default function Navbar({ settings, onOpenShare, onOpenAdmin, onViewMyBooking, isAdminView, onExitAdmin }) {
  const brandName = settings?.business_name || 'Zipaquirá Enterprise';

  return (
    <header className="sticky top-0 z-40 bg-[#070a14]/90 backdrop-blur-xl border-b border-blue-900/40 shadow-lg shadow-black/50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div 
          className="flex items-center gap-3.5 cursor-pointer group" 
          onClick={() => isAdminView ? onExitAdmin() : window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <img 
            src={settings?.logo_url || '/rufo-logo.png'} 
            alt={brandName} 
            className="h-12 w-auto max-w-[75px] object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.6)] group-hover:scale-105 transition-transform" 
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
                {brandName}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs font-medium text-gray-400 hidden sm:flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>{settings?.city || 'Zipaquirá, Colombia'}</span>
              <span className="text-gray-600">•</span>
              <span className="text-blue-400 font-mono text-[11px]">localhost:citas</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Consult my booking button */}
          {!isAdminView && (
            <button
              onClick={onViewMyBooking}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-blue-950/60 rounded-full transition-colors border border-blue-900/50"
            >
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Consultar Mi Cita</span>
            </button>
          )}

          {/* Share & QR Code pill */}
          <button
            onClick={onOpenShare}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-cyan-300 bg-blue-950/70 hover:bg-blue-900/70 rounded-full border border-cyan-500/40 transition shadow-md hover:shadow-cyan-500/20"
            title="Ver link y código QR para compartir"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">localhost:citas</span>
            <span className="sm:hidden">QR</span>
          </button>

          {/* Admin Portal Toggle */}
          {isAdminView ? (
            <button
              onClick={onExitAdmin}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gray-800 hover:bg-gray-700 rounded-full transition shadow border border-gray-700"
            >
              Salir del Admin
            </button>
          ) : (
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-full transition shadow-lg shadow-blue-600/40 hover:scale-105"
            >
              <Shield className="w-4 h-4 text-cyan-200" />
              <span>Admin</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
