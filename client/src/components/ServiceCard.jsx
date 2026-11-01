import React from 'react';
import { Star, Clock, Calendar, Sparkles } from 'lucide-react';

export default function ServiceCard({ service, currencySymbol = '$', currencyCode = 'COP', onSelect }) {
  const formattedPrice = `${currencySymbol} ${Number(service.price).toLocaleString()} ${currencyCode}`;

  return (
    <div className="group bg-[#0b0f1e] rounded-3xl overflow-hidden border border-blue-900/30 hover:border-blue-500/60 shadow-lg hover:shadow-2xl hover:shadow-blue-600/20 transition-all duration-300 flex flex-col justify-between">
      
      {/* Top Image & Badge Container */}
      <div className="relative h-52 w-full overflow-hidden bg-[#060914] flex items-center justify-center">
        <img
          src={service.image_url || '/rufo-logo.png'}
          alt={service.name}
          className={`w-full h-full ${service.image_url?.includes('rufo-logo') || !service.image_url ? 'object-contain p-4' : 'object-cover'} group-hover:scale-105 transition-transform duration-500 ease-out`}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1e] via-black/20 to-transparent pointer-events-none" />

        {/* Category Pill Tag */}
        <span className="absolute top-3 left-3 bg-[#070a14]/90 backdrop-blur-md text-cyan-300 text-xs font-black px-3 py-1 rounded-full border border-blue-500/30 shadow-md">
          {service.category || 'Servicio'}
        </span>

        {/* Optional Custom Badge */}
        {service.badge && (
          <span className="absolute top-3 right-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-blue-600/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-300 fill-yellow-300" />
            {service.badge}
          </span>
        )}

        {/* Rating and Duration overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-bold">
          <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-gray-800">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span>5.0</span>
            <span className="text-gray-400 font-normal">(VIP)</span>
          </div>
          <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-blue-900/50">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{service.duration_minutes} min</span>
          </div>
        </div>
      </div>

      {/* Card Details */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-2">
            {service.name}
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 leading-relaxed mb-5">
            {service.description || 'Atención personalizada de la más alta calidad con garantía de satisfacción.'}
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="pt-4 border-t border-blue-900/40 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-gray-400 block font-bold uppercase tracking-wider">Valor</span>
            <span className="text-xl font-black text-cyan-400 tracking-tight">
              {formattedPrice}
            </span>
          </div>

          <button
            onClick={() => onSelect(service)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all group-hover:scale-105"
          >
            <Calendar className="w-4 h-4" />
            <span>Agendar Cita</span>
          </button>
        </div>

      </div>

    </div>
  );
}
