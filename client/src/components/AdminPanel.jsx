import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, DollarSign, Users, CheckCircle, XCircle, RefreshCw,
  Plus, Edit2, Trash2, Settings as SettingsIcon, Mail, QrCode, Search,
  Filter, Phone, ExternalLink, Shield, Save, Eye, Bell,
  Sparkles, AlertCircle, Lock, User, KeyRound, Zap, ArrowRight,
  Flame, Gauge, Check, Sun, Sunset, Ban, CheckCircle2, AlertTriangle, RotateCcw,
  MapPin, MessageCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminPanel({ onOpenShare, onOpenEmailLogs, onExit, onSettingsSaved, onServicesSaved }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');

  // Lamborghini interactive states
  const [headlightsOn, setHeadlightsOn] = useState(true);
  const [sportMode, setSportMode] = useState(false);
  const [carAngle, setCarAngle] = useState(0);

  const [activeTab, setActiveTab] = useState('appointments'); // appointments | services | cms | notifications
  
  // Appointments state
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingApps, setLoadingApps] = useState(true);
  const [appSearch, setAppSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sendingReminderId, setSendingReminderId] = useState(null);

  // Services state
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Settings / CMS state
  const [settings, setSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState('');
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testWhatsAppMsg, setTestWhatsAppMsg] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  // Schedules & Cancellations Management state
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5, 6]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState({ type: '', text: '' });

  // Add new master slot form
  const [newSlotTime, setNewSlotTime] = useState('10:00');
  const [newSlotPeriod, setNewSlotPeriod] = useState('morning');

  // Block / cancel slot form
  const [blockDate, setBlockDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [blockTimeSlot, setBlockTimeSlot] = useState('ALL');
  const [blockReason, setBlockReason] = useState('Mantenimiento preventivo / Cierre temporal');

  // Network IP for phone scanning (so phone never tries localhost)
  const [lanIp, setLanIp] = useState('192.168.1.40');
  const [globalTunnelUrl, setGlobalTunnelUrl] = useState('https://part-sen-mathematical-eagle.trycloudflare.com/citas');

  useEffect(() => {
    fetch('/api/network-ip')
      .then((r) => r.json())
      .then((data) => {
        if (data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
          setLanIp(data.ip);
        }
        if (data.globalUrl) {
          setGlobalTunnelUrl(data.globalUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Check existing session
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const [serverError, setServerError] = useState(false);

  // Fetch admin data once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAppointments();
      fetchServices();
      fetchAdminSettings();
      fetchSchedulesOverview();

      // Real-time auto-refresh every 6 seconds
      const interval = setInterval(() => {
        fetchAppointments(true);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/settings/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (rememberMe) {
          localStorage.setItem('admin_token', data.token);
        }
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || 'Contraseña incorrecta');
      }
    } catch (err) {
      setLoginError('Error conectando con el servidor');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  const fetchAppointments = (isBackground = false) => {
    if (!isBackground) setLoadingApps(true);
    // Fetch all appointments so the Turn Monitor and KPIs are always 100% accurate
    fetch('/api/appointments?limit=200')
      .then((res) => {
        if (!res.ok) throw new Error('Error al consultar citas');
        return res.json();
      })
      .then((data) => {
        setAppointments(data.appointments || []);
        setStats(data.stats || {});
        setLoadingApps(false);
        setServerError(false);
      })
      .catch((err) => {
        setLoadingApps(false);
        setServerError(true);
      });
  };

  const fetchServices = () => {
    setLoadingServices(true);
    fetch('/api/services?all=true')
      .then((res) => res.json())
      .then((data) => {
        setServices(Array.isArray(data) ? data : []);
        setLoadingServices(false);
      })
      .catch(() => setLoadingServices(false));
  };

  const fetchAdminSettings = () => {
    fetch('/api/settings/admin')
      .then((res) => res.json())
      .then((data) => {
        setSettings(data || {});
      })
      .catch((err) => console.error(err));
  };

  // Schedules management functions
  const fetchSchedulesOverview = async () => {
    setLoadingSchedules(true);
    try {
      const res = await fetch('/api/schedules/overview');
      const data = await res.json();
      setScheduleSlots(data.slots || []);
      setBlockedSlots(data.blocked || []);
      if (data.workingDays) setWorkingDays(data.workingDays);
      setLoadingSchedules(false);
    } catch (err) {
      console.error(err);
      setLoadingSchedules(false);
    }
  };

  const handleToggleSlot = async (slotId) => {
    try {
      const res = await fetch(`/api/schedules/slots/${slotId}/toggle`, { method: 'PUT' });
      if (res.ok) {
        fetchSchedulesOverview();
        if (onServicesSaved) onServicesSaved();
        setScheduleMsg({ type: 'success', text: 'Estado del turno actualizado exitosamente' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('¿Estás seguro de eliminar este horario maestro de atención?')) return;
    try {
      const res = await fetch(`/api/schedules/slots/${slotId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSchedulesOverview();
        if (onServicesSaved) onServicesSaved();
        setScheduleMsg({ type: 'success', text: 'Horario eliminado correctamente' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/schedules/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_slot: newSlotTime,
          period: newSlotPeriod,
          period_label: newSlotPeriod === 'morning' ? 'Mañana' : 'Tarde',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchSchedulesOverview();
        if (onServicesSaved) onServicesSaved();
        setScheduleMsg({ type: 'success', text: `Turno ${newSlotTime} agregado exitosamente a la agenda.` });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 3000);
      } else {
        setScheduleMsg({ type: 'error', text: data.error || 'Error al agregar turno' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateSlotsFromHours = async () => {
    try {
      setLoadingSchedules(true);
      const res = await fetch('/api/schedules/generate-from-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_time: settings.opening_time || '08:00',
          closing_time: settings.closing_time || '18:00',
          interval: Number(settings.slot_interval_minutes) || 60,
        }),
      });
      const data = await res.json();
      setLoadingSchedules(false);
      if (res.ok) {
        fetchSchedulesOverview();
        if (onServicesSaved) onServicesSaved();
        setScheduleMsg({ type: 'success', text: data.message || 'Turnos sincronizados con éxito' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 4000);
      } else {
        setScheduleMsg({ type: 'error', text: data.error || 'Error sincronizando turnos' });
      }
    } catch (e) {
      setLoadingSchedules(false);
      setScheduleMsg({ type: 'error', text: 'Error al conectar con el servidor' });
    }
  };

  const handleAddBlockedSlot = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/schedules/blocked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: blockDate,
          time_slot: blockTimeSlot,
          reason: blockReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchSchedulesOverview();
        setScheduleMsg({ type: 'success', text: 'Horario o fecha cancelada/bloqueada con éxito para los clientes.' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 3000);
      } else {
        setScheduleMsg({ type: 'error', text: data.error || 'Error al cancelar horario' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveBlockedSlot = async (id) => {
    try {
      const res = await fetch(`/api/schedules/blocked/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSchedulesOverview();
        setScheduleMsg({ type: 'success', text: 'Horario desbloqueado y reactivado para reservas.' });
        setTimeout(() => setScheduleMsg({ type: '', text: '' }), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleWorkingDay = async (dayNum) => {
    const updated = workingDays.includes(dayNum)
      ? workingDays.filter(d => d !== dayNum)
      : [...workingDays, dayNum].sort((a, b) => a - b);
    setWorkingDays(updated);
    try {
      await fetch('/api/schedules/working-days', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ working_days: updated }),
      });
      setScheduleMsg({ type: 'success', text: 'Días de atención guardados exitosamente.' });
      setTimeout(() => setScheduleMsg({ type: '', text: '' }), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Appointment Status update
  const handleUpdateAppStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchAppointments();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger manual 30m reminder
  const handleSendReminder = async (id) => {
    setSendingReminderId(id);
    try {
      const res = await fetch(`/api/appointments/${id}/send-reminder`, {
        method: 'POST',
      });
      const data = await res.json();
      setSendingReminderId(null);
      if (res.ok) {
        alert(data.message || 'Recordatorio enviado con éxito');
        fetchAppointments();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      setSendingReminderId(null);
      alert('Error al enviar el recordatorio');
    }
  };

  // Save Service
  const handleSaveService = async (e) => {
    e.preventDefault();
    const isEdit = Boolean(editingService.id);
    const url = isEdit ? `/api/services/${editingService.id}` : '/api/services';
    const method = isEdit ? 'PUT' : 'POST';

    let finalImg = (editingService.image_url || '').trim();
    if (!finalImg.startsWith('http://') && !finalImg.startsWith('https://')) {
      finalImg = `https://zipaquira-citas.onrender.com${finalImg.startsWith('/') ? '' : '/'}${finalImg || 'rufo-logo.png'}`;
    }

    const payload = {
      ...editingService,
      image_url: finalImg,
      price: Number(editingService.price) || 0,
      duration_minutes: Number(editingService.duration_minutes) || 30,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowServiceModal(false);
        setEditingService(null);
        fetchServices();
        if (onServicesSaved) onServicesSaved();
      } else {
        const d = await res.json();
        alert('Error: ' + (d.error || 'No se pudo guardar el servicio'));
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este servicio?')) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchServices();
        if (onServicesSaved) onServicesSaved();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setSavingSettings(false);
      if (res.ok) {
        setSettingsSuccess('¡Configuración de RUFO Precise Detailing guardada exitosamente!');
        if (onSettingsSaved) onSettingsSaved(data.settings);
        if (onServicesSaved) onServicesSaved();
        fetchSchedulesOverview();
        setTimeout(() => setSettingsSuccess(''), 4000);
      } else {
        setSettingsError(data.error || 'Error al guardar la configuración');
      }
    } catch (err) {
      setSavingSettings(false);
      setSettingsError('Error al conectar con el servidor');
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailMsg('');
    try {
      const res = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: settings.admin_notification_email || settings.smtp_user || settings.contact_email }),
      });
      const data = await res.json();
      setTestingEmail(false);
      if (res.ok) {
        setTestEmailMsg(data.message || '¡Correo de prueba enviado con éxito!');
      } else {
        setTestEmailMsg('Error: ' + (data.error || 'No se pudo enviar'));
      }
    } catch (e) {
      setTestingEmail(false);
      setTestEmailMsg('Error al conectar con el servidor');
    }
  };

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true);
    setTestWhatsAppMsg('');
    try {
      const res = await fetch('/api/settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTestingWhatsApp(false);
      if (res.ok) {
        setTestWhatsAppMsg(data.message || '¡WhatsApp de prueba enviado con éxito!');
      } else {
        setTestWhatsAppMsg('Error: ' + (data.error || 'No se pudo enviar WhatsApp'));
      }
    } catch (e) {
      setTestingWhatsApp(false);
      setTestWhatsAppMsg('Error conectando con el servidor');
    }
  };

  // ========================================================
  // DYNAMIC 3D ANIMATED LOGIN SCREEN (Inspirada en imagen #2)
  // Con fondo negro y Lamborghini Huracán 3D Animado
  // ========================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#030409] text-white flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
        
        {/* Animated Background Fluid Plasma / Light Waves (matches image #2) */}
        <div className="absolute inset-0 bg-radial-gradient from-blue-900/20 via-purple-900/10 to-[#030409] pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        {/* Floating Neon Grid Lines */}
        <div 
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Main Futurism Login Window (Styled like user image #2) */}
        <div className="relative w-full max-w-5xl bg-[#090d1c]/90 backdrop-blur-2xl rounded-3xl border border-blue-500/30 shadow-[0_0_80px_rgba(37,99,235,0.25)] overflow-hidden flex flex-col lg:flex-row">
          
          {/* Top Brand Tag inside Window */}
          <div className="absolute top-5 left-6 sm:left-8 flex items-center gap-3 z-20">
            <img 
              src="/rufo-logo.png" 
              alt="RUFO Precise Detailing" 
              className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" 
            />
            <div>
              <span className="font-black text-sm tracking-wider text-white">RUFO PRECISE DETAILING</span>
              <span className="block text-[10px] text-cyan-400 font-mono font-bold tracking-widest">EACH PRECISE DETAIL COUNTS</span>
            </div>
          </div>

          {/* Quick Exit to Public Website Button */}
          <button
            onClick={onExit}
            className="absolute top-6 right-8 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-gray-800 transition z-20 flex items-center gap-1.5"
          >
            <span>Ver Portal Público</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* LEFT COLUMN: Modern Login Form */}
          <div className="w-full lg:w-5/12 p-8 sm:p-12 pt-24 sm:pt-28 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-blue-900/30">
            
            <div className="space-y-6">
              {/* Rufo Detailing Emblem Badge Avatar */}
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[2px] shadow-[0_0_30px_rgba(59,130,246,0.6)]">
                <div className="w-full h-full rounded-2xl bg-[#080c1b] flex items-center justify-center p-2 overflow-hidden">
                  <img src="/rufo-logo.png" alt="Rufo Detailing" className="w-full h-full object-contain" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#080c1b] flex items-center justify-center" title="Online">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Iniciar Sesión</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Ingresa tus credenciales para administrar citas, servicios y la página.
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Username Pill Input */}
                <div>
                  <div className="relative">
                    <User className="w-4 h-4 text-blue-400 absolute left-4 top-3.5" />
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Username / Usuario"
                      className="w-full pl-11 pr-4 py-3 rounded-full bg-white/5 border border-blue-500/30 text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition"
                    />
                  </div>
                </div>

                {/* Password Pill Input */}
                <div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-blue-400 absolute left-4 top-3.5" />
                    <input
                      type="password"
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Password / Contraseña"
                      className="w-full pl-11 pr-4 py-3 rounded-full bg-white/5 border border-blue-500/30 text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition"
                    />
                  </div>
                </div>

                {/* Remember Me Checkbox (as in image #2) */}
                <div className="flex items-center justify-between text-xs text-gray-400 px-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded bg-white/10 border-blue-500/40 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Remember me</span>
                  </label>
                  <span className="text-[11px] text-cyan-400 font-bold">RUFO Security</span>
                </div>

                {/* Glowing Pill Login Button (matching image #2 style) */}
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <span>Log In • Entrar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

              </form>

            </div>

            <div className="mt-8 pt-4 border-t border-blue-900/30 flex items-center justify-between text-[11px] text-gray-500">
              <span>RUFO Precise Detailing © 2026</span>
              <span className="text-cyan-400 font-mono">citas</span>
            </div>

          </div>

          {/* RIGHT COLUMN: Lamborghini Huracán 3D / Animated Showcase + "Welcome Back." */}
          <div className="w-full lg:w-7/12 p-8 sm:p-12 relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#070b1a] via-[#09112a] to-[#04060d]">
            
            {/* Luminous Neon Plasma Waves in background (matching image #2) */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
                <path
                  d="M0,300 C200,100 400,500 800,200 L800,600 L0,600 Z"
                  fill="url(#neonGradient)"
                  className="animate-wave-glow"
                />
                <defs>
                  <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Glowing Big Typography & Detailing Badge */}
            <div className="relative z-10 pt-10 sm:pt-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm backdrop-blur-md mb-3">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
                <span>EXCELLENCE IN AUTOMOTIVE DETAILING</span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
                RUFO <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300">
                  Precise Detailing.
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-cyan-200/80 max-w-sm mt-3 leading-relaxed font-medium">
                Panel maestro de administración, gestión de citas y control de calidad. <em>Each Precise Detail Counts.</em>
              </p>
            </div>

            {/* HIGH-END 3D RUFO EMBLEM SHOWCASE */}
            <div className="relative z-10 my-8 flex flex-col items-center justify-center">
              
              {/* Radial Halo Lighting */}
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
                headlightsOn ? 'bg-gradient-to-tr from-cyan-500/40 via-blue-600/30 to-indigo-500/20 opacity-100 scale-110' : 'bg-blue-600/20 opacity-50 scale-90'
              }`} />

              {/* RUFO Emblem with Floating 3D tilt & Luxury Reflection */}
              <div 
                className={`relative transition-all duration-700 ease-out animate-float-car cursor-pointer ${sportMode ? 'scale-105' : ''}`}
                style={{
                  transform: `perspective(1000px) rotateY(${carAngle}deg)`,
                }}
                onClick={() => setCarAngle(carAngle === 0 ? 12 : carAngle === 12 ? -12 : 0)}
              >
                {/* Outer Glass Aura */}
                <div className="p-4 sm:p-6 rounded-3xl bg-white/[0.03] backdrop-blur-sm border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.35)] flex items-center justify-center">
                  <img
                    src="/rufo-logo.png"
                    alt="RUFO Precise Detailing"
                    className={`w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px] object-contain transition-all duration-500 drop-shadow-[0_25px_35px_rgba(0,0,0,0.95)] drop-shadow-[0_0_35px_rgba(6,182,212,0.65)] hover:scale-105 ${
                      headlightsOn ? 'brightness-110 contrast-105' : ''
                    }`}
                  />
                </div>

                {/* Cyber Neon Ground Reflection */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-4/5 h-8 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-lg rounded-full" />
              </div>

            </div>

            {/* Bottom specs */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-gray-400 pt-4 border-t border-blue-900/40">
              <span className="flex items-center gap-1.5 font-bold text-gray-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Emblema Oficial RUFO • Precisión Grado Maestro</span>
              </span>
              <span className="text-cyan-400 font-mono font-bold tracking-wider">ZIPAQUIRÁ</span>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // ========================================================
  // AUTHENTICATED ADMIN DASHBOARD (DARK CYBER MODE)
  // ========================================================
  const statusBadges = {
    confirmed: { text: 'Confirmada', bg: 'bg-green-500/20 text-green-400 border-green-500/30' },
    rescheduled: { text: 'Reagendada', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    completed: { text: 'Completada', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    cancelled: { text: 'Cancelada', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };

  const brandName = settings.business_name || 'RUFO Precise Detailing';

  return (
    <div className="min-h-screen bg-[#050711] text-gray-100 pb-20">
      
      {/* Top Admin Bar */}
      <div className="bg-[#080c1a] text-white border-b border-blue-900/40 sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/rufo-logo.png" 
              alt="RUFO" 
              className="h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
            />
            <div>
              <h1 className="font-extrabold text-sm sm:text-base leading-tight flex items-center gap-2">
                <span>{brandName}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/30">Rufo Detailing</span>
              </h1>
              <p className="text-[11px] text-gray-400">Control de citas, servicios y diseño</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenShare}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900/80 text-xs font-bold text-cyan-300 border border-blue-500/40 transition"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ver QR / Enlace</span>
            </button>

            <button
              onClick={onOpenEmailLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-200 border border-gray-700 transition"
            >
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Registro de Correos</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-bold transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4 border-t border-blue-900/30 overflow-x-auto scrollbar-none text-xs sm:text-sm">
          {[
            { id: 'appointments', label: 'Citas & Auditoría', icon: Calendar },
            { id: 'services', label: 'Gestión de Servicios', icon: Sparkles },
            { id: 'schedules', label: 'Horarios & Cancelaciones', icon: Clock },
            { id: 'cms', label: 'Editar Página (Control Total)', icon: SettingsIcon },
            { id: 'notifications', label: 'Ajustes de Correo (SMTP)', icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 sm:px-4 font-extrabold border-b-2 whitespace-nowrap flex items-center gap-2 transition-all ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-blue-950/40 shadow-sm'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* ======================================================== */}
        {/* TAB 1: CITAS & AUDITORÍA */}
        {/* ======================================================== */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            
            {serverError && (
              <div className="p-4 rounded-2xl bg-amber-950/70 border-2 border-amber-500/60 text-amber-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
                  <span>
                    El servidor se está reconectando o está temporalmente inactivo. Haz clic para reintentar:
                  </span>
                </div>
                <button
                  onClick={() => fetchAppointments()}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition"
                >
                  Reconectar Ahora
                </button>
              </div>
            )}

            {/* Quick KPI Cards (Interactive 1-Click Filters) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setDateFilter(''); }}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  statusFilter === 'all' && !dateFilter
                    ? 'bg-blue-600/30 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
                    : 'bg-[#0a0f22] border-blue-900/40 hover:bg-blue-950/40'
                }`}
              >
                <div className="text-gray-400 text-[11px] font-bold uppercase mb-1">Todas las Citas</div>
                <div className="text-2xl font-black text-white">{stats.total || appointments.length || 0}</div>
                <span className="text-[10px] text-cyan-400 font-bold mt-1 block">Ver historial completo</span>
              </button>

              <button
                type="button"
                onClick={() => { setDateFilter(new Date().toISOString().slice(0, 10)); setStatusFilter('all'); }}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  dateFilter === new Date().toISOString().slice(0, 10)
                    ? 'bg-blue-600/30 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-400'
                    : 'bg-[#0a0f22] border-blue-900/40 hover:bg-blue-950/40'
                }`}
              >
                <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold uppercase mb-1">
                  <span>Para Hoy</span>
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-white">{stats.today || 0}</div>
                <span className="text-[10px] text-blue-400 font-bold mt-1 block">Turnos de hoy</span>
              </button>

              <button
                type="button"
                onClick={() => { setStatusFilter('confirmed'); setDateFilter(''); }}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  statusFilter === 'confirmed'
                    ? 'bg-emerald-950/60 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                    : 'bg-[#0a0f22] border-blue-900/40 hover:bg-emerald-950/30'
                }`}
              >
                <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold uppercase mb-1">
                  <span>Confirmadas</span>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                </div>
                <div className="text-2xl font-black text-green-400">{stats.confirmed || 0}</div>
                <span className="text-[10px] text-emerald-400 font-bold mt-1 block">Pendientes de atención</span>
              </button>

              <button
                type="button"
                onClick={() => { setStatusFilter('completed'); setDateFilter(''); }}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-purple-950/60 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-purple-400'
                    : 'bg-[#0a0f22] border-blue-900/40 hover:bg-purple-950/30'
                }`}
              >
                <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold uppercase mb-1">
                  <span>Completadas</span>
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-300">{stats.completed || 0}</div>
                <span className="text-[10px] text-purple-400 font-bold mt-1 block">Ya atendidas</span>
              </button>

              <button
                type="button"
                onClick={() => { setStatusFilter('cancelled'); setDateFilter(''); }}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  statusFilter === 'cancelled'
                    ? 'bg-red-950/60 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-1 ring-red-400'
                    : 'bg-[#0a0f22] border-blue-900/40 hover:bg-red-950/30'
                }`}
              >
                <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold uppercase mb-1">
                  <span>Canceladas</span>
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="text-2xl font-black text-red-400">{stats.cancelled || 0}</div>
                <span className="text-[10px] text-red-400 font-bold mt-1 block">Cupos liberados</span>
              </button>
            </div>

            {/* Quick Share Link & QR Banner (Matching user image #1) */}
            {(() => {
              const isCloud = typeof window !== 'undefined' && 
                window.location.hostname !== 'localhost' && 
                window.location.hostname !== '127.0.0.1' && 
                !window.location.hostname.startsWith('192.168.') && 
                !window.location.hostname.startsWith('10.');
              const bookingUrl = isCloud ? `${window.location.origin}/citas` : globalTunnelUrl;
              const displayUrl = bookingUrl.replace(/^https?:\/\//, '');
              
              return (
                <div className="bg-gradient-to-r from-blue-950 via-[#0a122e] to-black rounded-3xl p-6 text-white shadow-2xl border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl border-2 border-cyan-400 shadow-lg cursor-pointer" onClick={onOpenShare} title="Haz clic para ver opciones de QR">
                      <QRCodeSVG 
                        value={bookingUrl} 
                        size={74} 
                        level="M" 
                        fgColor="#000000" 
                        bgColor="#ffffff" 
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-black tracking-tight text-white">Enlace Público y Código QR de Agendamiento</h3>
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 border border-blue-500/40">
                          {displayUrl}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Global 4G/5G Activo
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 max-w-xl">
                        Enlace y QR globales activos: cualquier persona desde cualquier celular en el mundo (con datos 4G/5G o cualquier Wi-Fi) puede agendar citas.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={onOpenShare}
                      className="flex-1 md:flex-none px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm transition shadow-lg shadow-blue-600/40 flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <QrCode className="w-4 h-4 text-white" />
                      <span>Ver y Descargar QR</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Filter and Search Bar */}
            <div className="bg-[#0a0f22] p-4 rounded-2xl border border-blue-900/40 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, teléfono, correo o código CIT-..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAppointments()}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-xs text-gray-200"
                  title="Filtrar por fecha de la cita"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-xs text-gray-200 font-bold"
                >
                  <option value="all">Todos los estados</option>
                  <option value="confirmed">Confirmadas</option>
                  <option value="rescheduled">Reagendadas</option>
                  <option value="completed">Completadas</option>
                  <option value="cancelled">Canceladas</option>
                </select>

                {(statusFilter !== 'all' || dateFilter || appSearch) && (
                  <button
                    onClick={() => { setStatusFilter('all'); setDateFilter(''); setAppSearch(''); }}
                    className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Quitar filtros y ver todas las citas"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Limpiar Filtros</span>
                  </button>
                )}

                <button
                  onClick={fetchAppointments}
                  className="p-2.5 rounded-xl border border-blue-900/50 hover:bg-blue-950/60 text-gray-200 transition"
                  title="Refrescar"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingApps ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* MONITOR DE TURNOS EN VIVO (QUIÉN LE TOCA Y QUIÉN SIGUE) */}
            {/* ======================================================== */}
            {(() => {
              const activeUpcoming = [...appointments]
                .filter(a => a.status === 'confirmed' || a.status === 'rescheduled')
                .sort((a, b) => {
                  const dateTimeA = `${a.appointment_date}T${a.appointment_time || '00:00'}`;
                  const dateTimeB = `${b.appointment_date}T${b.appointment_time || '00:00'}`;
                  return dateTimeA.localeCompare(dateTimeB);
                });

              const currentTurn = activeUpcoming[0] || null;
              const nextTurn = activeUpcoming[1] || null;

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tarjeta 1: 🟢 EN TURNO / LE TOCA AHORA */}
                  <div className={`p-5 rounded-3xl border-2 transition shadow-xl flex flex-col justify-between ${
                    currentTurn 
                      ? 'bg-gradient-to-br from-emerald-950/80 via-emerald-900/40 to-black border-emerald-400 shadow-emerald-950/50' 
                      : 'bg-[#0a0f22] border-blue-900/40 opacity-70'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-400 text-black flex items-center gap-1.5 shadow-md shadow-emerald-400/40 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-black"></span>
                          🟢 LE TOCA EL TURNO (ACTUAL)
                        </span>
                        {currentTurn && (
                          <span className="font-mono text-xs font-black text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-500/50">
                            {currentTurn.code}
                          </span>
                        )}
                      </div>

                      {currentTurn ? (
                        <div className="space-y-2">
                          <div className="text-xl font-black text-white tracking-tight">{currentTurn.client_name}</div>
                          <div className="text-xs text-emerald-200 font-bold flex items-center gap-2">
                            <span>🚗 {currentTurn.service_name}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-black">${Number(currentTurn.service_price).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-gray-300 flex items-center gap-3 pt-1">
                            <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                              ⏰ {currentTurn.appointment_time} ({currentTurn.appointment_date})
                            </span>
                            <a
                              href={`https://wa.me/${currentTurn.client_phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1 font-bold text-xs"
                            >
                              <Phone className="w-3 h-3 text-emerald-400" />
                              <span>{currentTurn.client_phone}</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-gray-400 font-bold">
                          No hay turnos activos pendientes en este momento.
                        </div>
                      )}
                    </div>

                    {currentTurn && (
                      <div className="pt-4 border-t border-emerald-500/30 mt-3">
                        <button
                          onClick={() => handleUpdateAppStatus(currentTurn.id, 'completed')}
                          className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/30 transition cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4 text-black" />
                          <span>Marcar como Atendido / Completado</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta 2: 🟡 SIGUE EN FILA (PRÓXIMO TURNO) */}
                  <div className={`p-5 rounded-3xl border-2 transition shadow-xl flex flex-col justify-between ${
                    nextTurn 
                      ? 'bg-gradient-to-br from-amber-950/80 via-amber-900/40 to-black border-amber-400 shadow-amber-950/50' 
                      : 'bg-[#0a0f22] border-blue-900/40 opacity-70'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase bg-amber-400 text-black flex items-center gap-1.5 shadow-md shadow-amber-400/40">
                          <span className="w-2 h-2 rounded-full bg-black"></span>
                          🟡 SIGUE EN FILA (PRÓXIMO)
                        </span>
                        {nextTurn && (
                          <span className="font-mono text-xs font-black text-amber-300 bg-amber-950 px-2.5 py-0.5 rounded-full border border-amber-500/50">
                            {nextTurn.code}
                          </span>
                        )}
                      </div>

                      {nextTurn ? (
                        <div className="space-y-2">
                          <div className="text-xl font-black text-white tracking-tight">{nextTurn.client_name}</div>
                          <div className="text-xs text-amber-200 font-bold flex items-center gap-2">
                            <span>🚗 {nextTurn.service_name}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-black">${Number(nextTurn.service_price).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-gray-300 flex items-center gap-3 pt-1">
                            <span className="bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded-md font-bold">
                              ⏰ {nextTurn.appointment_time} ({nextTurn.appointment_date})
                            </span>
                            <a
                              href={`https://wa.me/${nextTurn.client_phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-300 hover:underline flex items-center gap-1 font-bold text-xs"
                            >
                              <Phone className="w-3 h-3 text-amber-400" />
                              <span>{nextTurn.client_phone}</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-gray-400 font-bold">
                          No hay más turnos en cola de espera.
                        </div>
                      )}
                    </div>

                    {nextTurn && (
                      <div className="pt-4 border-t border-amber-500/30 mt-3">
                        <button
                          onClick={() => handleSendReminder(nextTurn.id)}
                          disabled={sendingReminderId === nextTurn.id}
                          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/30 transition cursor-pointer"
                        >
                          <Bell className="w-4 h-4 text-black" />
                          <span>{sendingReminderId === nextTurn.id ? 'Avisando...' : 'Avisar que ya casi es su turno'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta 3: 🔴 RESUMEN & GUÍA DE IDENTIFICACIÓN */}
                  <div className="p-5 rounded-3xl border border-blue-900/40 bg-[#0a0f22] shadow-xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-900/40 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-gray-200">
                        🚦 Guía de Colores de Turnos
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                        {stats.cancelled || 0} Canceladas
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                        <span className="text-emerald-300 font-black">Verde:</span>
                        <span className="text-gray-300 text-[11px]">Le toca el turno ahora (en atención)</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-950/40 border border-amber-500/40">
                        <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-amber-300 font-black">Amarillo:</span>
                        <span className="text-gray-300 text-[11px]">Es el que sigue en la fila (próximo turno)</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-red-950/40 border border-red-500/40">
                        <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-red-300 font-black">Rojo:</span>
                        <span className="text-gray-300 text-[11px]">Turno cancelado (cupo liberado)</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Appointments Table */}
            <div className="bg-[#0a0f22] rounded-3xl border border-blue-900/40 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-900/40 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-white text-base">Registro Detallado de Citas & Auditoría</h3>
                  <p className="text-xs text-gray-400">Muestra la fecha programada y el momento exacto en que el cliente realizó el agendamiento.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-blue-500/20 text-cyan-300 rounded-full border border-blue-500/30">
                  {appointments.length} citas listadas
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#060a17] text-gray-400 uppercase font-bold text-[11px] border-b border-blue-900/40">
                    <tr>
                      <th className="px-5 py-3.5">Código</th>
                      <th className="px-5 py-3.5">Cliente / Contacto</th>
                      <th className="px-5 py-3.5">Servicio & Valor</th>
                      <th className="px-5 py-3.5">Fecha y Hora de la Cita</th>
                      <th className="px-5 py-3.5 bg-blue-950/40 text-cyan-300 font-black">
                        🕒 Agendado el (Auditoría)
                      </th>
                      <th className="px-5 py-3.5">Estado</th>
                      <th className="px-5 py-3.5">Recordatorio 30m</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-900/20">
                    {loadingApps ? (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-gray-500">
                          Cargando citas...
                        </td>
                      </tr>
                    ) : appointments.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-gray-500">
                          No se encontraron citas con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const filteredAppointments = appointments.filter((app) => {
                          if (statusFilter !== 'all' && app.status !== statusFilter) return false;
                          if (dateFilter && app.appointment_date !== dateFilter) return false;
                          if (appSearch) {
                            const q = appSearch.toLowerCase().trim();
                            const match = (app.client_name || '').toLowerCase().includes(q) ||
                                          (app.client_phone || '').toLowerCase().includes(q) ||
                                          (app.client_email || '').toLowerCase().includes(q) ||
                                          (app.code || '').toLowerCase().includes(q) ||
                                          (app.service_name || '').toLowerCase().includes(q);
                            if (!match) return false;
                          }
                          return true;
                        });

                        if (filteredAppointments.length === 0) {
                          return (
                            <tr>
                              <td colSpan="8" className="text-center py-12 text-gray-400">
                                <div className="space-y-2">
                                  <p className="font-bold text-sm">No se encontraron citas con los filtros seleccionados.</p>
                                  <p className="text-xs text-gray-500">Hay {appointments.length} citas registradas en el sistema en total.</p>
                                  <button
                                    onClick={() => { setStatusFilter('all'); setDateFilter(''); setAppSearch(''); }}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                                  >
                                    Ver Todas las Citas ({appointments.length})
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        const activeUpcoming = [...appointments]
                          .filter(a => a.status === 'confirmed' || a.status === 'rescheduled')
                          .sort((a, b) => {
                            const dateTimeA = `${a.appointment_date}T${a.appointment_time || '00:00'}`;
                            const dateTimeB = `${b.appointment_date}T${b.appointment_time || '00:00'}`;
                            return dateTimeA.localeCompare(dateTimeB);
                          });

                        const currentTurn = activeUpcoming[0] || null;
                        const nextTurn = activeUpcoming[1] || null;

                        return filteredAppointments.map((app) => {
                          const creationDate = new Date(app.created_at);
                          const creationFormatted = creationDate.toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          });

                          const isCurrentTurn = app.id === currentTurn?.id;
                          const isNextTurn = app.id === nextTurn?.id;
                          const isCancelled = app.status === 'cancelled';
                          const isCompleted = app.status === 'completed';

                          let rowClass = 'hover:bg-blue-950/20';
                          let borderClass = 'border-l-4 border-l-transparent';
                          let badgeRender = (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                              🔵 EN ESPERA
                            </span>
                          );

                          if (isCurrentTurn) {
                            rowClass = 'bg-emerald-950/40 hover:bg-emerald-900/40 shadow-[inset_0_0_25px_rgba(16,185,129,0.12)]';
                            borderClass = 'border-l-4 border-l-emerald-400';
                            badgeRender = (
                              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-black flex items-center gap-1.5 shadow-md shadow-emerald-500/40 animate-pulse whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-black"></span>
                                🟢 LE TOCA AHORA
                              </span>
                            );
                          } else if (isNextTurn) {
                            rowClass = 'bg-amber-950/30 hover:bg-amber-900/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]';
                            borderClass = 'border-l-4 border-l-amber-400';
                            badgeRender = (
                              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-400 text-black flex items-center gap-1.5 shadow-md shadow-amber-500/30 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-black"></span>
                                🟡 SIGUE EN FILA
                              </span>
                            );
                          } else if (isCancelled) {
                            rowClass = 'bg-red-950/20 hover:bg-red-900/30 opacity-75';
                            borderClass = 'border-l-4 border-l-red-500';
                            badgeRender = (
                              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1 whitespace-nowrap">
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                🔴 CANCELADO
                              </span>
                            );
                          } else if (isCompleted) {
                            rowClass = 'hover:bg-blue-950/20 opacity-60';
                            badgeRender = (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                🟣 COMPLETADA
                              </span>
                            );
                          }

                          return (
                            <tr key={app.id} className={`${rowClass} ${borderClass} transition`}>
                              {/* Code */}
                              <td className="px-5 py-4 font-mono font-black">
                                <span className={
                                  isCurrentTurn ? 'text-emerald-300 text-sm tracking-wider font-black' :
                                  isNextTurn ? 'text-amber-300 text-sm tracking-wider font-black' :
                                  isCancelled ? 'text-red-400 line-through' :
                                  'text-cyan-400'
                                }>
                                  {app.code}
                                </span>
                              </td>

                              {/* Client */}
                              <td className="px-5 py-4">
                                <div className={`font-bold flex items-center gap-2 ${
                                  isCurrentTurn ? 'text-emerald-100 font-black text-sm' :
                                  isNextTurn ? 'text-amber-100 font-black text-sm' :
                                  isCancelled ? 'text-red-300 line-through' :
                                  'text-white'
                                }`}>
                                  <span>{app.client_name}</span>
                                  {isCurrentTurn && (
                                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 animate-pulse">
                                      🟢 Turno 1
                                    </span>
                                  )}
                                  {isNextTurn && (
                                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                                      🟡 Turno 2
                                    </span>
                                  )}
                                </div>
                                <div className="text-gray-400 text-xs">{app.client_email}</div>
                                <div className="mt-0.5">
                                  <a
                                    href={`https://wa.me/${app.client_phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`hover:underline inline-flex items-center gap-1 text-[11px] font-bold ${
                                      isCurrentTurn ? 'text-emerald-400' : isNextTurn ? 'text-amber-300' : 'text-green-400'
                                    }`}
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{app.client_phone}</span>
                                  </a>
                                </div>
                              </td>

                              {/* Service */}
                              <td className="px-5 py-4">
                                <div className={`font-bold ${isCurrentTurn ? 'text-emerald-100' : isNextTurn ? 'text-amber-100' : 'text-gray-200'}`}>
                                  {app.service_name}
                                </div>
                                <div className={`font-extrabold text-xs ${isCurrentTurn ? 'text-emerald-400 font-black' : isNextTurn ? 'text-amber-400 font-black' : 'text-cyan-400'}`}>
                                  ${Number(app.service_price).toLocaleString()}
                                </div>
                                <div className="text-gray-500 text-[11px]">{app.service_duration} min</div>
                              </td>

                              {/* Scheduled date */}
                              <td className="px-5 py-4">
                                <div className={`font-black ${isCurrentTurn ? 'text-emerald-300' : isNextTurn ? 'text-amber-300' : isCancelled ? 'text-red-300 line-through' : 'text-white'}`}>
                                  {app.appointment_date}
                                </div>
                                <div className={`font-bold text-xs ${isCurrentTurn ? 'text-emerald-400' : isNextTurn ? 'text-amber-400' : isCancelled ? 'text-red-400' : 'text-blue-400'}`}>
                                  ⏰ {app.appointment_time}
                                </div>
                              </td>

                              {/* Audit creation timestamp */}
                              <td className="px-5 py-4 bg-blue-950/30">
                                <div className="font-bold text-cyan-300 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>{creationFormatted}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium">Momento exacto del registro</span>
                              </td>

                              {/* Status with Distinct Colors */}
                              <td className="px-5 py-4">
                                {badgeRender}
                              </td>

                              {/* 30m Reminder */}
                              <td className="px-5 py-4">
                                {app.reminder_sent ? (
                                  <span className="inline-flex items-center gap-1 text-green-400 font-bold text-xs">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Enviado</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSendReminder(app.id)}
                                    disabled={sendingReminderId === app.id || app.status === 'cancelled'}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-40"
                                    title="Enviar recordatorio de 30m por correo inmediatamente"
                                  >
                                    <Bell className="w-3 h-3 text-amber-400" />
                                    <span>{sendingReminderId === app.id ? 'Enviando...' : 'Enviar Ahora'}</span>
                                  </button>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-5 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  
                                  {/* 📅 Google Calendar Auto Add for Admin */}
                                  <a
                                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Cita: ${app.service_name} - ${app.client_name}`)}&dates=${app.appointment_date.replace(/-/g, '')}T${app.appointment_time.replace(/:/g, '')}00/${app.appointment_date.replace(/-/g, '')}T${app.appointment_time.replace(/:/g, '')}00&details=${encodeURIComponent(`Cita para ${app.service_name}.\nCliente: ${app.client_name}\nTeléfono: ${app.client_phone}\nCódigo: ${app.code}\nValor: $${Number(app.service_price).toLocaleString()} COP\nLugar: ${settings?.address || 'Calle 5 # 10-25'}\n\n* Recordatorio automático 30 min antes.`)}&location=${encodeURIComponent(settings?.address || 'Calle 5 # 10-25, Zipaquirá')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 px-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-cyan-300 border border-blue-500/40 transition flex items-center gap-1 text-[11px] font-bold"
                                    title="Guardar en tu Google Calendar con alarma 30m"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Calendar</span>
                                  </a>

                                  {/* Reactivar cita completada o cancelada */}
                                  {(app.status === 'completed' || app.status === 'cancelled') && (
                                    <button
                                      onClick={() => handleUpdateAppStatus(app.id, 'confirmed')}
                                      className="p-1.5 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                      title="Reactivar Turno (Devolver a Pendiente de atención)"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Reactivar</span>
                                    </button>
                                  )}

                                  {app.status !== 'completed' && app.status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleUpdateAppStatus(app.id, 'completed')}
                                      className="p-1.5 px-2.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                      title="Marcar como Atendida"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                      <span>Finalizar</span>
                                    </button>
                                  )}
                                  {app.status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleUpdateAppStatus(app.id, 'cancelled')}
                                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 transition cursor-pointer"
                                      title="Cancelar Cita"
                                    >
                                      <XCircle className="w-4 h-4 text-red-400" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SERVICIOS */}
        {/* ======================================================== */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Catálogo de Servicios</h3>
                <p className="text-xs text-gray-400">Agrega, edita o desactiva los servicios que tus clientes verán en la página.</p>
              </div>

              <button
                onClick={() => {
                  setEditingService({
                    name: '',
                    category: 'General',
                    description: '',
                    price: 45000,
                    duration_minutes: 30,
                    badge: '',
                    image_url: 'https://zipaquira-citas.onrender.com/rufo-logo.png',
                    is_active: 1,
                  });
                  setShowServiceModal(true);
                }}
                className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-600/40 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Servicio</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((s) => (
                <div key={s.id} className="bg-[#0a0f22] rounded-3xl border border-blue-900/40 shadow-xl overflow-hidden flex flex-col justify-between">
                  <div className="relative h-40 bg-gray-900">
                    <img src={s.image_url} alt={s.name} className="w-full h-full object-cover opacity-90" />
                    <span className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-cyan-300 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-blue-500/30">
                      {s.category}
                    </span>
                    {s.badge && (
                      <span className="absolute top-3 right-3 bg-blue-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                        {s.badge}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-black text-white text-base">{s.name}</h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1">{s.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-blue-900/40 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-gray-500 block uppercase font-bold">Precio & Duración</span>
                        <span className="text-base font-black text-cyan-300">
                          ${Number(s.price).toLocaleString()} • {s.duration_minutes} min
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            let cleanUrl = (s.image_url || '').trim();
                            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                              cleanUrl = `https://zipaquira-citas.onrender.com${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl || 'rufo-logo.png'}`;
                            }
                            setEditingService({
                              ...s,
                              image_url: cleanUrl,
                            });
                            setShowServiceModal(true);
                          }}
                          className="p-2 rounded-xl border border-blue-900/50 hover:bg-blue-950/60 text-cyan-300 transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(s.id)}
                          className="p-2 rounded-xl border border-red-900/50 hover:bg-red-950/60 text-red-400 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Service Modal */}
            {showServiceModal && editingService && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                <div className="w-full max-w-lg bg-[#0a0f22] text-white rounded-3xl shadow-2xl border border-blue-500/40 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-900/50 pb-3">
                    <h3 className="text-lg font-black text-white">
                      {editingService.id ? 'Editar Servicio' : 'Agregar Nuevo Servicio'}
                    </h3>
                    <button
                      onClick={() => setShowServiceModal(false)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveService} noValidate className="space-y-3.5 text-xs sm:text-sm">
                    <div>
                      <label className="block font-bold text-gray-300 mb-1">Nombre del Servicio *</label>
                      <input
                        type="text"
                        required
                        value={editingService.name}
                        onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                        placeholder="Ej. Servicio Premium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-gray-300 mb-1">Categoría</label>
                        <input
                          type="text"
                          value={editingService.category}
                          onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-300 mb-1">Badge / Etiqueta</label>
                        <input
                          type="text"
                          value={editingService.badge || ''}
                          onChange={(e) => setEditingService({ ...editingService, badge: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                          placeholder="Ej. VIP, Top"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-gray-300 mb-1">Precio ($) *</label>
                        <input
                          type="number"
                          required
                          value={editingService.price}
                          onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })}
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-300 mb-1">Duración (Minutos) *</label>
                        <input
                          type="number"
                          required
                          step="5"
                          value={editingService.duration_minutes}
                          onChange={(e) => setEditingService({ ...editingService, duration_minutes: Number(e.target.value) })}
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-300 mb-1">Descripción</label>
                      <textarea
                        rows="2"
                        value={editingService.description || ''}
                        onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-xs resize-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-gray-300">Foto / Imagen (Opcional)</label>
                        <span className="text-[10px] text-cyan-400">Predeterminada: Logo RUFO</span>
                      </div>
                      <input
                        type="text"
                        placeholder="/rufo-logo.png"
                        value={editingService.image_url || ''}
                        onChange={(e) => setEditingService({ ...editingService, image_url: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-xs"
                      />
                    </div>

                    <div className="pt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowServiceModal(false)}
                        className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 font-bold text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30"
                      >
                        Guardar Servicio
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: HORARIOS & CANCELACIÓN DE TURNOS */}
        {/* ======================================================== */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <Clock className="w-6 h-6 text-cyan-400" />
                  <span>Gestión de Horarios y Cancelación de Turnos</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Modifica los horarios de atención recurrentes y cancela o bloquea turnos/fechas específicas en tiempo real.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchSchedulesOverview}
                className="px-4 py-2 rounded-xl bg-blue-950/70 border border-blue-500/40 text-cyan-300 text-xs font-bold hover:bg-blue-900 transition flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSchedules ? 'animate-spin' : ''}`} />
                <span>Refrescar Horarios</span>
              </button>
            </div>

            {scheduleMsg.text && (
              <div className={`p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 border ${
                scheduleMsg.type === 'error'
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-green-500/20 border-green-500/40 text-green-300'
              }`}>
                {scheduleMsg.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
                <span>{scheduleMsg.text}</span>
              </div>
            )}

            {/* PARTE 1: MODIFICAR HORARIOS DE SERVICIOS (TURNOS MAESTROS) */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-blue-900/40 pb-3 gap-3">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <span>1. Turnos de Atención del Negocio (Horarios Recurrentes)</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 border border-blue-500/30">
                      {scheduleSlots.filter(s => s.is_active).length} activos
                    </span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Activa, pausa o agrega nuevos horarios en los que RUFO Precise Detailing recibe vehículos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateSlotsFromHours}
                  disabled={loadingSchedules}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
                  title="Genera turnos automáticos cada intervalo entre la hora de apertura y cierre configurada"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  <span>⚡ Sincronizar con Horario ({settings?.opening_time || '08:00'} - {settings?.closing_time || '18:00'})</span>
                </button>
              </div>

              {/* Grid de Turnos Actuales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {scheduleSlots.map((slot) => {
                  const isMorning = slot.period === 'morning' || slot.time_slot < '12:00';
                  return (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        slot.is_active
                          ? 'bg-blue-950/30 border-blue-500/40 shadow-sm'
                          : 'bg-black/30 border-gray-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isMorning ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {isMorning ? <Sun className="w-3 h-3 text-amber-400" /> : <Sunset className="w-3 h-3 text-cyan-400" />}
                          <span>{slot.period_label || (isMorning ? 'Mañana' : 'Tarde')}</span>
                        </span>
                        
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          slot.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {slot.is_active ? 'Activo' : 'Pausado'}
                        </span>
                      </div>

                      <div className="text-xl font-black text-white font-mono my-1">
                        {slot.label || slot.time_slot}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {slot.time_slot} (24h)
                      </div>

                      <div className="mt-3 pt-3 border-t border-blue-900/40 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSlot(slot.id)}
                          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            slot.is_active
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          <span>{slot.is_active ? 'Pausar' : 'Activar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-1 px-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs transition cursor-pointer"
                          title="Eliminar este horario permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Formulario Agregar Nuevo Horario */}
              <form onSubmit={handleAddSlot} className="bg-black/30 p-4 rounded-2xl border border-blue-900/50 flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full sm:w-auto">
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Hora del Nuevo Turno (Formato 24h)
                  </label>
                  <input
                    type="time"
                    required
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-blue-900/60 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="w-full sm:w-48">
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Jornada
                  </label>
                  <select
                    value={newSlotPeriod}
                    onChange={(e) => setNewSlotPeriod(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-blue-900/60 text-white font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="morning">🌅 Mañana</option>
                    <option value="afternoon">🌆 Tarde</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Turno</span>
                </button>
              </form>

              {/* Días Laborables de la Semana */}
              <div className="pt-2 border-t border-blue-900/30">
                <label className="block text-xs font-bold text-gray-300 mb-2">
                  Días en que se atiende citas en la semana (Haz clic para activar/desactivar):
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { num: 1, label: 'Lunes' },
                    { num: 2, label: 'Martes' },
                    { num: 3, label: 'Miércoles' },
                    { num: 4, label: 'Jueves' },
                    { num: 5, label: 'Viernes' },
                    { num: 6, label: 'Sábado' },
                    { num: 0, label: 'Domingo' },
                  ].map((d) => {
                    const isChecked = workingDays.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => handleToggleWorkingDay(d.num)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                          isChecked
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-black/40 text-gray-400 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <span>{isChecked ? '✓' : '✗'}</span>
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* PARTE 2: CANCELAR / BLOQUEAR HORARIOS POR FECHA (BLACKOUTS) */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-blue-900/40 pb-3">
                <div>
                  <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Ban className="w-5 h-5 text-red-400" />
                    <span>2. Cancelar o Bloquear Horarios por Fecha</span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Si no vas a atender en un turno o día determinado (por mantenimiento, festivo o imprevisto), cancélalo aquí para que los clientes no puedan agendarlo.
                  </p>
                </div>
              </div>

              {/* Formulario para Cancelar Horario */}
              <form onSubmit={handleAddBlockedSlot} className="bg-red-950/20 border border-red-500/30 p-5 rounded-2xl space-y-4">
                <h5 className="text-sm font-black text-red-300 flex items-center gap-1.5">
                  <span>Formulario de Cancelación de Horario</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Fecha a Cancelar *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-red-500/40 text-white font-bold text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Turno a Cancelar *
                    </label>
                    <select
                      value={blockTimeSlot}
                      onChange={(e) => setBlockTimeSlot(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-red-500/40 text-white font-bold text-sm focus:outline-none"
                    >
                      <option value="ALL">🚫 TODO EL DÍA (Cierre completo)</option>
                      {scheduleSlots.map((s) => (
                        <option key={s.id} value={s.time_slot}>
                          ⏰ Turno: {s.label || s.time_slot} ({s.period_label || s.period})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Motivo de la Cancelación
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Mantenimiento de maquinaria, Cierre por festivo"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-red-500/40 text-white text-xs sm:text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Cancelar / Bloquear Horario</span>
                  </button>
                </div>
              </form>

              {/* Lista de Horarios Cancelados Activos */}
              <div>
                <h5 className="text-xs font-black text-gray-300 uppercase tracking-wider mb-3">
                  Horarios y Días Actualmente Cancelados / Bloqueados ({blockedSlots.length}):
                </h5>

                {blockedSlots.length === 0 ? (
                  <div className="p-6 bg-black/20 rounded-2xl border border-gray-800 text-center text-xs font-bold text-gray-500">
                    No hay horarios bloqueados o cancelados. Todos los turnos configurados están disponibles para reservas.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {blockedSlots.map((b) => (
                      <div
                        key={b.id}
                        className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-red-400 font-mono">
                              {b.block_date}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                              {b.time_slot ? `Turno ${b.time_slot}` : 'Día Completo'}
                            </span>
                          </div>

                          <p className="text-xs text-gray-300 font-medium mt-1">
                            <strong className="text-white">Motivo:</strong> {b.reason || 'Cancelado por administración'}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-red-500/20 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveBlockedSlot(b.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Rehabilitar Horario</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CONTROL TOTAL DE LA PÁGINA (CMS) */}
        {/* ======================================================== */}
        {activeTab === 'cms' && (
          <form onSubmit={handleSaveSettings} noValidate className="space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Personalización y Control Total</h3>
                <p className="text-xs text-gray-400">Modifica los textos, banners, horarios de atención y datos de contacto de RUFO Precise Detailing.</p>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-600/40 transition"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>

            {settingsSuccess && (
              <div className="p-3.5 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-300 text-xs sm:text-sm font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {/* General Branding */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-4">
              <h4 className="font-extrabold text-white text-base border-b border-blue-900/40 pb-2">
                1. Identidad de la Marca & Encabezado (Hero)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Nombre del Negocio *</label>
                  <input
                    type="text"
                    required
                    value={settings.business_name || ''}
                    onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Eslogan / Tagline</label>
                  <input
                    type="text"
                    value={settings.tagline || ''}
                    onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">Título Principal (Hero Title) *</label>
                <input
                  type="text"
                  required
                  value={settings.hero_title || ''}
                  onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">Subtítulo / Descripción</label>
                <textarea
                  rows="2"
                  value={settings.hero_subtitle || ''}
                  onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-gray-300">URL del Logo (Opcional)</label>
                    <span className="text-[10px] text-cyan-400">Predeterminado: Logo RUFO</span>
                  </div>
                  <input
                    type="text"
                    value={settings.logo_url || ''}
                    onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white text-xs"
                    placeholder="/rufo-logo.png"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Moneda</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.currency_symbol || '$'}
                      onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                      className="w-16 px-3 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-center text-white font-bold"
                    />
                    <input
                      type="text"
                      value={settings.currency_code || 'COP'}
                      onChange={(e) => setSettings({ ...settings, currency_code: e.target.value.toUpperCase() })}
                      className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-blue-900/50 text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location & Contact */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-4">
              <h4 className="font-extrabold text-white text-base border-b border-blue-900/40 pb-2">
                2. Ubicación & Contacto
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Dirección del Local / Taller</label>
                  <input
                    type="text"
                    placeholder="Ej: Carrera 10 # 5-20 (o dejar vacío)"
                    value={settings.address || ''}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Ciudad</label>
                  <input
                    type="text"
                    placeholder="Ej: Zipaquirá, Colombia"
                    value={settings.city || ''}
                    onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white"
                  />
                </div>
              </div>

              {/* Live Location Preview */}
              <div className="p-3 bg-black/30 rounded-2xl border border-blue-900/30 flex items-center gap-2 text-xs text-gray-300">
                <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>
                  <strong>Vista previa de Ubicación:</strong>{' '}
                  {settings.address ? (
                    settings.city && !settings.address.toLowerCase().includes(settings.city.toLowerCase())
                      ? `${settings.address}, ${settings.city}`
                      : settings.address
                  ) : (
                    settings.city || 'Zipaquirá, Colombia'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Teléfono Móvil / WhatsApp</label>
                  <input
                    type="text"
                    value={settings.whatsapp || settings.phone || ''}
                    onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white"
                    placeholder="+57 300 604 2818"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Correo de Contacto</label>
                  <input
                    type="email"
                    value={settings.contact_email || ''}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-blue-900/40 pb-2">
                <h4 className="font-extrabold text-white text-base">
                  3. Horarios de Atención
                </h4>
                <span className="text-[11px] font-bold text-cyan-300 bg-blue-950 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  RUFO Detailing: 8:00 AM, 9:00 AM, 2:00 PM, 3:00 PM
                </span>
              </div>
              
              <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl text-xs text-blue-200">
                ⚡ <strong>Horarios exclusivos configurados:</strong> Los clientes pueden agendar turnos en la mañana a las <strong>8:00 AM</strong> y <strong>9:00 AM</strong>, y en la tarde a las <strong>2:00 PM</strong> y <strong>3:00 PM</strong> (puedes activar o cancelar turnos en la pestaña <em>Horarios & Cancelaciones</em>).
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">
                  Texto Visible del Horario de Atención en la Web
                </label>
                <input
                  type="text"
                  placeholder="Ej: 8:00 AM - 9:00 AM • 2:00 PM - 3:00 PM"
                  value={settings.business_hours_text || ''}
                  onChange={(e) => setSettings({ ...settings, business_hours_text: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white font-bold text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Este es el texto exacto que ven tus clientes en el pie de página bajo <strong>"Horario de Atención"</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Apertura</label>
                  <input
                    type="time"
                    value={settings.opening_time || '08:00'}
                    onChange={(e) => setSettings({ ...settings, opening_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Cierre</label>
                  <input
                    type="time"
                    value={settings.closing_time || '19:00'}
                    onChange={(e) => setSettings({ ...settings, closing_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Intervalo de Turnos</label>
                  <select
                    value={settings.slot_interval_minutes || 30}
                    onChange={(e) => setSettings({ ...settings, slot_interval_minutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white font-bold"
                  >
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos (Recomendado)</option>
                    <option value="45">45 minutos</option>
                    <option value="60">60 minutos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-4">
              <h4 className="font-extrabold text-white text-base border-b border-blue-900/40 pb-2">
                4. Credenciales de Acceso (Usuario y Contraseña)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="block font-bold text-gray-300 mb-1 text-xs sm:text-sm">Usuario Administrador</label>
                  <input
                    type="text"
                    placeholder="pedrito"
                    value={settings.admin_username || 'pedrito'}
                    onChange={(e) => setSettings({ ...settings, admin_username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1 text-xs sm:text-sm">Nueva Contraseña</label>
                  <input
                    type="password"
                    placeholder="Dejar vacío para mantener la actual"
                    value={settings.admin_password || ''}
                    onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-600/40 transition"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 4: AJUSTES DE CORREO & NOTIFICACIONES */}
        {/* ======================================================== */}
        {activeTab === 'notifications' && (
          <form onSubmit={handleSaveSettings} noValidate className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Configuración de Correos y Notificaciones</h3>
                <p className="text-xs text-gray-400">
                  Controla a qué correo te llegan las alertas de nuevas citas y configura tu servidor SMTP.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenEmailLogs}
                  className="px-4 py-2 rounded-full border border-blue-900 text-cyan-300 hover:bg-blue-950/60 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Buzón de Auditoría</span>
                </button>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-600/30 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Guardando...' : 'Guardar Ajustes'}</span>
                </button>
              </div>
            </div>

            {settingsSuccess && (
              <div className="p-3.5 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-300 text-xs sm:text-sm font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {/* Admin Notification Recipient */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-4">
              <h4 className="font-extrabold text-white text-base border-b border-blue-900/40 pb-2 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                <span>Correo del Administrador para Recibir Notificaciones</span>
              </h4>
              <p className="text-xs text-gray-400">
                Cada vez que un cliente agende, aplace o cancele una cita, el sistema enviará un correo automático a esta dirección con el registro de la hora exacta de agendamiento y los datos del cliente.
              </p>

              <div className="max-w-md">
                <input
                  type="email"
                  required
                  value={settings.admin_notification_email || ''}
                  onChange={(e) => setSettings({ ...settings, admin_notification_email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                  placeholder="admin@rufodetailing.com"
                />
              </div>
            </div>

            {/* SMTP & HTTP API Mail Server Configuration */}
            <div className="bg-[#0a0f22] p-6 rounded-3xl border border-blue-900/40 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-blue-900/40 pb-4 gap-2">
                <div>
                  <h4 className="font-extrabold text-white text-base">Servidores de Envío Automático de Correos</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Envía notificaciones automáticas tanto al cliente como al administrador ({settings.admin_notification_email || settings.contact_email || 'ru88foramirez@hotmail.com'}).
                  </p>
                </div>
                <div>
                  {settings.google_script_url ? (
                    <span className="text-[11px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Google Script Webhook Activo
                    </span>
                  ) : settings.brevo_api_key ? (
                    <span className="text-[11px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      Brevo API Activo
                    </span>
                  ) : settings.resend_api_key ? (
                    <span className="text-[11px] font-black uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Resend API Activo
                    </span>
                  ) : settings.smtp_enabled ? (
                    <span className="text-[11px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      SMTP Activo
                    </span>
                  ) : (
                    <span className="text-[11px] font-black uppercase bg-gray-700 text-gray-300 px-3 py-1 rounded-full">
                      🟡 Modo Simulación
                    </span>
                  )}
                </div>
              </div>

              {/* OPCION 1: WEBHOOK DE GOOGLE APPS SCRIPT (RECOMENDADA • 100% GRATIS • SIN LÍMITE DE DOMINIO) */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/70 via-blue-950/80 to-indigo-950/70 border-2 border-emerald-500/50 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h5 className="font-extrabold text-white text-sm">
                      Opción 1 (Recomendada): Webhook de Google Apps Script (Gmail)
                    </h5>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-emerald-400 text-black px-2.5 py-0.5 rounded-full shadow">
                    100% Automático • Sin Restricciones
                  </span>
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  Envía correos directamente desde tu Gmail (<strong>juanbernate157@gmail.com</strong>) a <strong>cualquier cliente</strong> y a <strong>ru88foramirez@hotmail.com</strong> de forma automática por el puerto 443 HTTPS (nunca se bloquea en Render). No requiere contraseñas de Hotmail ni dominios de pago.
                </p>

                <div>
                  <label className="block font-bold text-gray-200 text-xs mb-1">
                    URL de la Aplicación Web de Google Script (termina en /exec)
                  </label>
                  <input
                    type="text"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    value={settings.google_script_url || ''}
                    onChange={(e) => setSettings({ ...settings, google_script_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-emerald-500/60 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-black/40 rounded-xl border border-emerald-500/20 text-[11px] text-gray-300 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-black text-emerald-300">⚡ Guía de 1 minuto para activar Google Apps Script:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `function doPost(e) {\\n  try {\\n    var data = JSON.parse(e.postData.contents);\\n    GmailApp.sendEmail(data.to, data.subject, "", {\\n      htmlBody: data.html,\\n      name: data.fromName || "RUFO Precise Detailing"\\n    });\\n    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);\\n  } catch (err) {\\n    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);\\n  }\\n}`;
                        navigator.clipboard.writeText(code);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 3000);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition shadow"
                    >
                      {copiedScript ? '✅ ¡Código Copiado!' : '📋 Copiar Código del Script'}
                    </button>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-gray-300">
                    <li>Entra a <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-bold">script.google.com</a> con tu cuenta juanbernate157@gmail.com y pulsa <strong>"Nuevo proyecto"</strong>.</li>
                    <li>Borra el texto, haz clic en el botón <strong>"Copiar Código del Script"</strong> de arriba, pégalo allí y pulsa Guardar (Ctrl + S).</li>
                    <li>Pulsa el botón azul <strong>"Implementar"</strong> (arriba a la derecha) &rarr; <strong>"Nueva implementación"</strong> &rarr; Selecciona <strong>"Aplicación web"</strong>.</li>
                    <li>Configura: <em>Ejecutar como:</em> <strong>Yo</strong> • <em>Quién tiene acceso:</em> <strong>Cualquiera</strong> &rarr; Pulsa <strong>Implementar</strong>.</li>
                    <li>Copia la URL que termina en <code>/exec</code>, pégala arriba y haz clic en <strong>Guardar Configuración</strong>.</li>
                  </ol>
                </div>
              </div>

              {/* OPCION 2: RESEND API (HTTPS) */}
              <div className="p-4 bg-gradient-to-r from-blue-950/50 via-slate-900/60 to-blue-950/50 border border-blue-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <h5 className="font-extrabold text-white text-sm">
                      Opción 2: Resend API (Tu clave de resend.com)
                    </h5>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    3,000 correos/mes gratis
                  </span>
                </div>
                <p className="text-xs text-gray-300">
                  Si creaste tu clave en <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">resend.com</a> (la que empieza por <code>re_...</code>), pégala aquí:
                </p>
                <div>
                  <input
                    type="password"
                    placeholder="re_FwPo9zPi..."
                    value={settings.resend_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, resend_api_key: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-blue-500/40 text-white font-mono text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    * Nota: En el modo gratuito de prueba de Resend entrega correos al correo del creador (juanbernate157@gmail.com). Para clientes externos requiere verificar un dominio propio en Resend o usar la Opción 1.
                  </p>
                </div>
              </div>

              {/* OPCION 3: BREVO API */}
              <div className="p-4 bg-gradient-to-r from-slate-900/60 to-blue-950/40 border border-blue-900/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h5 className="font-extrabold text-gray-200 text-xs uppercase tracking-wider">
                    Opción 3: Brevo API (Sendinblue • 300 correos/día a cualquier bandeja)
                  </h5>
                  <span className="text-[10px] text-gray-400">api.brevo.com</span>
                </div>
                <input
                  type="password"
                  placeholder="xkeysib-..."
                  value={settings.brevo_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, brevo_api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-blue-900/50 text-white font-mono text-xs"
                />
              </div>

              {/* OPCION 4: SMTP TRADICIONAL GMAIL */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-gray-300 text-xs uppercase tracking-wider">
                    Opción 4: Servidor SMTP Clásico (Gmail)
                  </h5>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-500/40">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.smtp_enabled)}
                      onChange={(e) => setSettings({ ...settings, smtp_enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-black text-white">Activar SMTP</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Host SMTP</label>
                    <input
                      type="text"
                      placeholder="smtp.gmail.com"
                      value={settings.smtp_host || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Puerto SMTP</label>
                    <input
                      type="number"
                      placeholder="465 (SSL) o 587"
                      value={settings.smtp_port || 587}
                      onChange={(e) => setSettings({ ...settings, smtp_port: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Usuario / Correo Remitente</label>
                    <input
                      type="text"
                      placeholder="tucorreo@gmail.com"
                      value={settings.smtp_user || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Contraseña de Aplicación de Google</label>
                    <input
                      type="password"
                      placeholder="Contraseña de 16 caracteres"
                      value={settings.smtp_pass || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-blue-900/50 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* REENVÍO AUTOMÁTICO EN GMAIL CALLOUT */}
              <div className="p-3.5 bg-blue-950/40 rounded-2xl border border-blue-500/30 text-[11px] text-gray-300 space-y-1">
                <span className="font-extrabold text-cyan-300 block text-xs">
                  📬 ¿Cómo hacer que todas las notificaciones de tu Gmail también le caigan automáticamente al administrador ({settings.contact_email || 'ru88foramirez@hotmail.com'})?
                </span>
                <p>
                  En tu pantalla abierta de Gmail (<strong>Configuración &rarr; Reenvío y correo POP/IMAP</strong>): escribe <code>{settings.contact_email || 'ru88foramirez@hotmail.com'}</code> en la casilla de reenvío, pídele el código de confirmación de 9 dígitos que le enviará Google a su Hotmail por única vez, confírmalo y selecciona <em>"Reenviar una copia del correo entrante"</em>. ¡Listo!
                </p>
              </div>

            {/* Botón para probar el envío en vivo */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-blue-900/40">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Mail className={`w-4 h-4 ${testingEmail ? 'animate-bounce' : ''}`} />
                <span>{testingEmail ? 'Enviando prueba...' : '🧪 Enviar Correo de Prueba a mi Bandeja'}</span>
              </button>

              {testEmailMsg && (
                <span className={`text-xs font-bold ${testEmailMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {testEmailMsg}
                </span>
              )}
            </div>
          </div>

          {/* WHATSAPP AUTOMÁTICO EN LA NUBE (CALLMEBOT API) */}
          <div className="bg-[#0a0f22] p-6 rounded-3xl border-2 border-emerald-500/40 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-500/30 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <div>
                  <h4 className="font-extrabold text-white text-base">
                    Notificación 100% Automática por WhatsApp al Administrador
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Envía un mensaje de WhatsApp a <strong>{settings.callmebot_phone || settings.whatsapp || '+57 300 604 2818'}</strong> directamente desde el servidor apenas el cliente agenda, sin que el cliente tenga que enviar nada.
                  </p>
                </div>
              </div>
              <div>
                {settings.callmebot_api_key ? (
                  <span className="text-[11px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    WhatsApp Automático ACTIVO
                  </span>
                ) : (
                  <span className="text-[11px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full">
                    🟡 Pendiente Activar Clave
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-gray-200 mb-1">
                  Número de WhatsApp del Administrador
                </label>
                <input
                  type="text"
                  value={settings.callmebot_phone || '+573006042818'}
                  onChange={(e) => setSettings({ ...settings, callmebot_phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-emerald-500/40 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  placeholder="+573006042818"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Formato internacional con código de país (ej: +573006042818).
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-200 mb-1">
                  API Key de CallMeBot (Clave gratuita de 6 dígitos)
                </label>
                <input
                  type="text"
                  placeholder="Ejemplo: 123456"
                  value={settings.callmebot_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, callmebot_api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-emerald-500/40 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  La clave numérica que te entrega el bot por WhatsApp al activarlo.
                </p>
              </div>
            </div>

            {/* Guía rápida de activación */}
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-xs text-gray-300 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-emerald-300">
                  ⚡ ¿Cómo activar el WhatsApp automático en 10 segundos? (100% Gratis)
                </span>
                <a
                  href="https://wa.me/34623786449?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 transition hover:scale-105"
                >
                  <MessageCircle className="w-4 h-4 fill-white text-emerald-700" />
                  <span>👉 Toca aquí para obtener la Clave de Pedrito</span>
                </a>
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-gray-300 text-[11px]">
                <li>Toca el botón verde o desde el celular de Pedrito (<strong>+57 300 604 2818</strong>) envía por WhatsApp este mensaje a <strong>+34 623 78 64 49</strong>: <code className="bg-black/60 px-1 py-0.5 rounded text-emerald-300">I allow callmebot to send me messages</code></li>
                <li>En pocos segundos el bot te responderá: <em>"API Activated for your phone number. Your APIKEY is XXXXXX"</em>.</li>
                <li>Pega ese número de 6 dígitos en la casilla <strong>API Key de CallMeBot</strong> de arriba y pulsa <strong>Guardar Ajustes</strong>.</li>
              </ol>
            </div>

            {/* Botón de prueba de WhatsApp */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-emerald-500/20">
              <button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={testingWhatsApp}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-500/50 text-emerald-200 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <MessageCircle className={`w-4 h-4 ${testingWhatsApp ? 'animate-bounce' : ''}`} />
                <span>{testingWhatsApp ? 'Enviando WhatsApp de prueba...' : '🧪 Enviar WhatsApp de Prueba al Administrador'}</span>
              </button>

              {testWhatsAppMsg && (
                <span className={`text-xs font-bold ${testWhatsAppMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {testWhatsAppMsg}
                </span>
              )}
            </div>
          </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-600/40 transition"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Guardando...' : 'Guardar Configuración'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
