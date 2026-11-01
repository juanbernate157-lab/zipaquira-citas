import React from 'react';
import { Search, MapPin, Calendar, Sparkles, QrCode, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Hero({ settings, searchTerm, setSearchTerm, selectedCategory, onSelectCategory, categories, onOpenShare }) {
  const brandName = settings?.business_name || 'Zipaquirá Enterprise';

  return (
    <div className="relative overflow-hidden zipaquira-hero-gradient pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-blue-950/60">
      
      {/* Dynamic ambient blue/cyan halos */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-80 bg-gradient-to-b from-blue-600/25 via-cyan-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto text-center">
        
        {/* Top Tagline Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs sm:text-sm font-bold shadow-md shadow-blue-900/30 mb-6">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-white font-extrabold">{brandName}</span>
          <span className="text-blue-400">•</span>
          <span>{settings?.tagline || 'Innovación & Excelencia en Cada Servicio'}</span>
        </div>

        {/* Main Title - Explicitly "Reserva tu cita" as requested by user */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.1] mb-5">
          Reserva tu cita
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-blue-200/90 max-w-2xl mx-auto mb-10 font-normal leading-relaxed">
          {settings?.hero_subtitle || 'Agenda tus servicios de manera rápida, cómoda y segura con los mejores profesionales.'}
        </p>

        {/* Modern Cyber Glass Pill Search Box */}
        <div className="max-w-3xl mx-auto glass-pill-dark rounded-full p-2 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-0 shadow-2xl border border-blue-500/30">
          
          {/* Treatment Search */}
          <div className="flex-1 flex items-center px-4 py-2.5 md:py-1">
            <Search className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar servicio o tratamiento..."
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none"
            />
          </div>

          <div className="hidden md:block w-px h-8 bg-blue-900/60" />

          {/* Location Info */}
          <div className="flex-1 flex items-center px-4 py-2.5 md:py-1">
            <MapPin className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" />
            <div className="text-left w-full">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Ubicación</p>
              <p className="text-sm font-bold text-gray-200 truncate">
                {settings?.city || 'Zipaquirá, Colombia'}
              </p>
            </div>
          </div>

          <div className="hidden md:block w-px h-8 bg-blue-900/60" />

          {/* Schedule Info */}
          <div className="flex-1 flex items-center px-4 py-2.5 md:py-1">
            <Calendar className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" />
            <div className="text-left">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Horario de Atención</p>
              <p className="text-sm font-bold text-gray-200">
                {settings?.opening_time || '08:00'} - {settings?.closing_time || '19:00'}
              </p>
            </div>
          </div>

          {/* Search Button (Vibrant Electric Blue Pill) */}
          <button
            onClick={() => {
              const el = document.getElementById('services-grid');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="md:ml-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold px-8 py-3.5 rounded-full text-sm sm:text-base transition-all duration-200 shadow-lg shadow-blue-600/40 hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>Buscar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Social Proof and Share Pill */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs sm:text-sm text-gray-300">
          <span className="font-bold text-white tracking-tight text-sm sm:text-base flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Atención de Alto Nivel • 100% Citas Confirmadas</span>
          </span>
          <span className="hidden sm:inline text-blue-900">•</span>
          <button
            onClick={onOpenShare}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/70 border border-blue-500/40 text-cyan-300 hover:bg-blue-900 font-bold transition shadow-sm"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Enlace: localhost:citas</span>
          </button>
        </div>

      </div>

      {/* Categories Horizontal Tabs */}
      <div className="max-w-7xl mx-auto mt-12">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none justify-start md:justify-center">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-cyan-400/50'
                : 'bg-[#0d1326] text-gray-300 hover:bg-blue-950/80 border border-blue-900/50'
            }`}
          >
            Todos los servicios
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-cyan-400/50'
                  : 'bg-[#0d1326] text-gray-300 hover:bg-blue-950/80 border border-blue-900/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
