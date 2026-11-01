import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ServiceCard from './components/ServiceCard';
import BookingModal from './components/BookingModal';
import ManageAppointmentModal from './components/ManageAppointmentModal';
import ShareQRModal from './components/ShareQRModal';
import AdminPanel from './components/AdminPanel';
import EmailLogsModal from './components/EmailLogsModal';
import {
  Sparkles, MapPin, Phone, Mail, Clock,
  Calendar, Shield, QrCode, Heart, CheckCircle2, Zap, MessageCircle
} from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Navigation View: 'public' | 'admin'
  const [currentView, setCurrentView] = useState('public');

  // Modals state
  const [bookingService, setBookingService] = useState(null);
  const [manageCode, setManageCode] = useState('');
  const [manageAction, setManageAction] = useState('');
  const [showManageModal, setShowManageModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmailLogsModal, setShowEmailLogsModal] = useState(false);

  // Check URL routes (e.g. /cita/CIT-123 or #admin or /citas)
  useEffect(() => {
    const handleUrlRouting = () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);

      if (pathname.includes('/admin') || hash === '#admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('public');
      }

      // Check if client opened a booking link like /cita/CIT-ABCDE
      if (pathname.includes('/cita/')) {
        const parts = pathname.split('/cita/');
        if (parts[1]) {
          const code = parts[1].replace('/', '');
          setManageCode(code);
          setManageAction(searchParams.get('action') || '');
          setShowManageModal(true);
        }
      }
    };

    handleUrlRouting();
    window.addEventListener('popstate', handleUrlRouting);
    window.addEventListener('hashchange', handleUrlRouting);
    return () => {
      window.removeEventListener('popstate', handleUrlRouting);
      window.removeEventListener('hashchange', handleUrlRouting);
    };
  }, []);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [resSettings, resServices] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/services'),
      ]);

      const dataSettings = await resSettings.json();
      const dataServices = await resServices.json();

      setSettings(dataSettings);
      setServices(Array.isArray(dataServices) ? dataServices : []);

      // Extract unique categories
      const cats = Array.from(new Set(dataServices.map((s) => s.category).filter(Boolean)));
      setCategories(cats);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered services
  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      searchTerm.trim() === '' ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050711] flex flex-col items-center justify-center space-y-4 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin shadow-lg shadow-blue-500/50" />
        <p className="text-sm font-extrabold text-blue-400 font-mono tracking-wider">Cargando RUFO Precise Detailing...</p>
      </div>
    );
  }

  const brandName = settings?.business_name || 'RUFO Precise Detailing';

  // ADMIN VIEW
  if (currentView === 'admin') {
    return (
      <>
        <Navbar
          settings={settings}
          isAdminView={true}
          onExitAdmin={() => {
            window.location.hash = '';
            setCurrentView('public');
          }}
          onOpenShare={() => setShowShareModal(true)}
          onViewMyBooking={() => {}}
        />

        <AdminPanel
          onOpenShare={() => setShowShareModal(true)}
          onOpenEmailLogs={() => setShowEmailLogsModal(true)}
          onSettingsSaved={(newSettings) => {
            if (newSettings) setSettings(newSettings);
            fetchData();
          }}
          onExit={() => {
            window.location.hash = '';
            setCurrentView('public');
            fetchData();
          }}
        />

        {showShareModal && (
          <ShareQRModal settings={settings} onClose={() => setShowShareModal(false)} />
        )}

        {showEmailLogsModal && (
          <EmailLogsModal
            adminEmail={settings?.admin_notification_email || settings?.contact_email}
            onClose={() => setShowEmailLogsModal(false)}
          />
        )}
      </>
    );
  }

  // PUBLIC CLIENT VIEW
  return (
    <div className="min-h-screen flex flex-col bg-[#050711] text-gray-100 selection:bg-blue-600 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        settings={settings}
        isAdminView={false}
        onOpenAdmin={() => {
          window.location.hash = 'admin';
          setCurrentView('admin');
        }}
        onOpenShare={() => setShowShareModal(true)}
        onViewMyBooking={() => {
          setManageCode('');
          setManageAction('');
          setShowManageModal(true);
        }}
      />

      {/* Hero Banner with "Reserva tu cita" as requested */}
      <Hero
        settings={settings}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={categories}
        onOpenShare={() => setShowShareModal(true)}
      />

      {/* Services Grid Section */}
      <main id="services-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex-1 w-full">
        
        {/* Section Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 border-b border-blue-900/40 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">Catálogo Disponible</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Servicios Disponibles</span>
              <Sparkles className="w-5 h-5 text-blue-400" />
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Selecciona tu tratamiento o servicio preferido y programa tu turno en segundos.
            </p>
          </div>

          <div className="text-xs font-bold text-gray-400 px-3 py-1.5 rounded-full bg-blue-950/60 border border-blue-900/50">
            Mostrando <strong className="text-cyan-300 font-mono">{filteredServices.length}</strong> servicios
          </div>
        </div>

        {/* Services Cards */}
        {filteredServices.length === 0 ? (
          <div className="py-20 text-center bg-[#090d1f] rounded-3xl border border-blue-900/40 p-8 shadow-xl">
            <Calendar className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No encontramos servicios con ese criterio</h3>
            <p className="text-xs text-gray-400 mt-1 mb-5">Prueba buscando con otra palabra o seleccionando otra categoría.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
            >
              Ver todos los servicios
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                currencySymbol={settings?.currency_symbol || '$'}
                currencyCode={settings?.currency_code || 'COP'}
                onSelect={(s) => setBookingService(s)}
              />
            ))}
          </div>
        )}

      </main>

      {/* Footer (Dark Cyber Theme) */}
      <footer className="bg-[#04060d] border-t border-blue-900/40 mt-20 pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-blue-900/30">
            
            {/* Brand Info */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <img src="/rufo-logo.png" alt="RUFO" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                <h3 className="text-lg font-black text-white">{brandName}</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {settings?.tagline || 'Innovación, estilo y excelencia en agendamiento de servicios VIP.'}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-950/70 hover:bg-blue-900 border border-blue-500/40 text-cyan-300 text-xs font-bold transition shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Compartir QR / Enlace</span>
                </button>
              </div>
            </div>

            {/* Location & Hours */}
            <div className="space-y-2 text-xs text-gray-400">
              <h4 className="font-black text-white uppercase tracking-wider text-[11px]">Ubicación</h4>
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-200">
                  {settings?.address ? (
                    settings?.city && !settings.address.toLowerCase().includes(settings.city.toLowerCase())
                      ? `${settings.address}, ${settings.city}`
                      : settings.address
                  ) : (
                    settings?.city || 'Zipaquirá, Colombia'
                  )}
                </span>
              </p>
              <h4 className="font-black text-white uppercase tracking-wider text-[11px] pt-3">Horario de Atención</h4>
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-gray-200">{settings?.business_hours_text || '8:00 AM - 9:00 AM • 2:00 PM - 3:00 PM'}</span>
              </p>
            </div>

            {/* Contact Details */}
            <div className="space-y-2 text-xs text-gray-400">
              <h4 className="font-black text-white uppercase tracking-wider text-[11px]">Contacto Directo</h4>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-400 flex-shrink-0" />
                <a
                  href={`tel:${(settings?.phone || settings?.whatsapp || '+57 300 604 2818').replace(/\s+/g, '')}`}
                  className="hover:underline hover:text-green-300 font-medium text-gray-200 transition"
                  title="Llamar directamente"
                >
                  {settings?.phone || settings?.whatsapp || '+57 300 604 2818'}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <a
                  href={`mailto:${settings?.contact_email || 'juanbernate157@gmail.com'}`}
                  className="hover:underline hover:text-blue-300 transition"
                  title="Enviar correo"
                >
                  {settings?.contact_email || 'juanbernate157@gmail.com'}
                </a>
              </p>
              {(settings?.whatsapp || settings?.phone) && (
                <div className="pt-1.5">
                  <a
                    href={`https://wa.me/${(settings?.whatsapp || settings?.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent('¡Hola RUFO Precise Detailing! Me gustaría solicitar información sobre sus servicios de detailing.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition shadow-sm hover:scale-105"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp: {settings?.whatsapp || settings?.phone || '+57 300 604 2818'}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h4 className="font-black text-white uppercase tracking-wider text-[11px]">Gestión</h4>
              <button
                onClick={() => {
                  setManageCode('');
                  setManageAction('');
                  setShowManageModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/70 border border-blue-900/50 text-gray-200 text-xs font-bold text-center transition"
              >
                Consultar / Aplazar / Cancelar Cita
              </button>

              <button
                onClick={() => {
                  window.location.hash = 'admin';
                  setCurrentView('admin');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black text-center transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-200" />
                <span>Acceso Administrador</span>
              </button>
            </div>

          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
            <p>© {new Date().getFullYear()} {brandName}. Todos los derechos reservados.</p>
            <p className="flex items-center gap-1">
              <span>Recordatorios automáticos a los 30 min • RUFO Precise Detailing</span>
            </p>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {bookingService && (
        <BookingModal
          service={bookingService}
          settings={settings}
          onClose={() => setBookingService(null)}
          onBookingSuccess={() => fetchData()}
        />
      )}

      {showManageModal && (
        <ManageAppointmentModal
          initialCode={manageCode}
          initialAction={manageAction}
          onClose={() => {
            setShowManageModal(false);
            setManageCode('');
            setManageAction('');
          }}
          onUpdated={() => fetchData()}
        />
      )}

      {showShareModal && (
        <ShareQRModal
          settings={settings}
          onClose={() => setShowShareModal(false)}
        />
      )}

    </div>
  );
}
