import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertTriangle, CheckCircle2, RefreshCw, Trash2, ArrowLeft, Search, MapPin, QrCode, Sun, Sunset } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ManageAppointmentModal({ initialCode = '', initialAction = '', onClose, onUpdated }) {
  const [searchCode, setSearchCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState('');
  const [actionView, setActionView] = useState(initialAction); // '' | 'reschedule' | 'cancel'

  // Reschedule state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // Cancel state
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [qrBaseUrl, setQrBaseUrl] = useState('');

  useEffect(() => {
    fetch('/api/network-ip')
      .then((r) => r.json())
      .then((data) => {
        if (data.globalUrl) {
          setQrBaseUrl(data.globalUrl.replace(/\/citas$/, ''));
        } else if (data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
          setQrBaseUrl(`http://${data.ip}:5000`);
        } else {
          setQrBaseUrl(window.location.origin);
        }
      })
      .catch(() => {
        setQrBaseUrl(window.location.origin);
      });
  }, []);

  // Auto-search if code provided
  useEffect(() => {
    if (initialCode) {
      handleLookup(initialCode);
    }
  }, [initialCode]);

  const handleLookup = async (codeToSearch) => {
    const code = (codeToSearch || searchCode).trim().toUpperCase();
    if (!code) {
      setError('Por favor ingresa un código de cita válido.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/appointments/code/${code}`);
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'No se encontró ninguna cita con ese código.');
        setAppointment(null);
        return;
      }

      setAppointment(data.appointment);
      setBusiness(data.business);
      setNewDate(data.appointment.appointment_date);
    } catch (err) {
      setLoading(false);
      setError('Error al consultar la cita. Inténtalo de nuevo.');
    }
  };

  // Fetch slots when rescheduling date changes
  useEffect(() => {
    if (actionView !== 'reschedule' || !newDate || !appointment) return;

    setLoadingSlots(true);
    setNewTime('');

    fetch(`/api/appointments/available-slots?date=${newDate}&duration=${appointment.service_duration || 30}`)
      .then((res) => res.json())
      .then((data) => {
        setLoadingSlots(false);
        setAvailableSlots(data.slots || []);
      })
      .catch(() => {
        setLoadingSlots(false);
        setAvailableSlots([]);
      });
  }, [actionView, newDate, appointment]);

  // Execute Reschedule
  const handleConfirmReschedule = async () => {
    if (!newDate || !newTime) {
      setError('Debes elegir una nueva fecha y hora para reprogramar tu cita.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/appointments/${appointment.code}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_date: newDate,
          new_time: newTime,
          notes: rescheduleNotes,
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        setError(data.error || 'No se pudo reprogramar la cita.');
        return;
      }

      setAppointment(data.appointment);
      setActionView('');
      setSuccessMsg('¡Cita aplazada / reprogramada exitosamente! Te hemos enviado los nuevos datos a tu correo.');
      if (onUpdated) onUpdated();
    } catch (err) {
      setSubmitting(false);
      setError('Error al conectar con el servidor.');
    }
  };

  // Execute Cancel
  const handleConfirmCancel = async () => {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/appointments/${appointment.code}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason || 'Cancelada por el cliente',
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        setError(data.error || 'No se pudo cancelar la cita.');
        return;
      }

      setAppointment(data.appointment);
      setActionView('');
      setSuccessMsg('Tu cita ha sido cancelada y el espacio fue liberado. Te enviamos la confirmación al correo.');
      if (onUpdated) onUpdated();
    } catch (err) {
      setSubmitting(false);
      setError('Error al cancelar la cita.');
    }
  };

  const statusBadges = {
    confirmed: { text: 'Confirmada', bg: 'bg-green-100 text-green-800 border-green-200' },
    rescheduled: { text: 'Reagendada', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
    completed: { text: 'Completada', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
    cancelled: { text: 'Cancelada', bg: 'bg-red-100 text-red-800 border-red-200' },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in text-gray-900">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-500/40 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-gray-900 px-6 py-5 text-white flex items-center justify-between border-b border-blue-900/50">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-black text-white">Gestión de Citas • RUFO Precise Detailing</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input if not loaded */}
        {!appointment && (
          <div className="p-6 bg-white">
            <h3 className="text-base font-black text-gray-900 mb-2">
              Ingresa el código de tu cita
            </h3>
            <p className="text-xs text-gray-600 mb-4 font-semibold">
              Encuentra el código de 5 caracteres que recibiste en tu correo de confirmación (ejemplo: CIT-A1B2C).
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="CIT-XXXXX"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 uppercase font-mono font-black tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center gap-2 transition shadow-md"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Buscar</span>
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Appointment Found Details */}
        {appointment && (
          <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-white">
            
            {successMsg && (
              <div className="p-3.5 rounded-xl bg-green-50 border border-green-300 text-green-900 text-xs sm:text-sm flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs sm:text-sm flex items-center gap-2 font-bold">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* NORMAL VIEW: Details & Action Buttons */}
            {actionView === '' && (
              <div className="space-y-4">
                
                {/* Status Header & Code */}
                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-2xl border border-blue-200">
                  <div>
                    <span className="text-xs text-blue-800 font-bold block uppercase tracking-wider">Código de Reserva</span>
                    <span className="font-mono text-2xl font-black text-blue-950 tracking-wider">{appointment.code}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${statusBadges[appointment.status]?.bg || 'bg-gray-100 text-gray-800'}`}>
                    {statusBadges[appointment.status]?.text || appointment.status}
                  </span>
                </div>

                {/* Details Table */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2.5 text-sm font-semibold">
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-bold">Cliente:</span>
                    <span className="font-black text-gray-900">{appointment.client_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-bold">Servicio:</span>
                    <span className="font-black text-blue-900">{appointment.service_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-bold">Fecha y Hora Programada:</span>
                    <span className="font-black text-gray-900">{appointment.appointment_date} • {appointment.appointment_time}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-bold">Duración:</span>
                    <span className="text-gray-900">{appointment.service_duration} minutos</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-bold">Valor:</span>
                    <span className="font-black text-green-700 text-base">${Number(appointment.service_price).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-bold">Registrada el:</span>
                    <span className="text-gray-700 text-xs font-mono">{new Date(appointment.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Clear White High-Contrast QR Code for check-in */}
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 text-center flex flex-col items-center justify-center">
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
                    Presenta este código al llegar a RUFO Precise Detailing
                  </p>
                  <div className="p-3 bg-white border-2 border-gray-200 rounded-2xl shadow-sm">
                    <QRCodeSVG
                      value={`${qrBaseUrl || window.location.origin}/cita/${appointment.code}`}
                      size={140}
                      level="H"
                      fgColor="#000000"
                      bgColor="#ffffff"
                      includeMargin={true}
                    />
                  </div>
                </div>

                {/* Action Buttons: Aplazar / Cancelar */}
                {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setActionView('reschedule')}
                      className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Aplazar / Reagendar Cita</span>
                    </button>

                    <button
                      onClick={() => setActionView('cancel')}
                      className="flex-1 py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span>Cancelar Cita</span>
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* RESCHEDULE VIEW (Aplazar) */}
            {actionView === 'reschedule' && (
              <div className="space-y-4">
                <button
                  onClick={() => setActionView('')}
                  className="inline-flex items-center gap-1 text-xs font-black text-gray-700 hover:text-black"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a detalles
                </button>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                  <h4 className="font-black text-blue-900 text-sm">Aplazar / Reprogramar Cita</h4>
                  <p className="text-xs text-blue-800 mt-0.5 font-medium">
                    Elige una nueva fecha y hora. Tu turno anterior ({appointment.appointment_date} {appointment.appointment_time}) será liberado automáticamente.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-900 mb-1">
                    Nueva Fecha
                  </label>
                  <input
                    type="date"
                    min={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black text-gray-900">
                      Nuevo Horario Disponible
                    </label>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Turnos RUFO Precise Detailing
                    </span>
                  </div>
                  {loadingSlots ? (
                    <div className="py-6 text-center text-xs font-bold text-gray-600">Cargando turnos disponibles...</div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-4 bg-gray-100 rounded-xl text-xs font-bold text-gray-600 text-center">
                      No hay turnos disponibles para esta fecha.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Mañana */}
                      {availableSlots.some(s => s.period === 'morning' || s.time < '12:00') && (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-900 uppercase tracking-wider mb-1.5">
                            <Sun className="w-3.5 h-3.5 text-amber-600" />
                            <span>Jornada Mañana</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableSlots.filter(s => s.period === 'morning' || s.time < '12:00').map((slot) => (
                              <button
                                key={slot.time}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => setNewTime(slot.time)}
                                title={slot.isBlocked ? `Cancelado por el administrador: ${slot.blockReason}` : ''}
                                className={`py-2 px-2 rounded-xl text-xs font-black transition text-center flex flex-col items-center justify-center ${
                                  newTime === slot.time
                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-cyan-400'
                                    : !slot.available
                                    ? slot.isBlocked
                                      ? 'bg-red-50 text-red-500 border border-red-200 cursor-not-allowed opacity-80'
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 opacity-60'
                                    : 'bg-white hover:bg-blue-50 text-gray-900 border-2 border-gray-200'
                                }`}
                              >
                                <span className={`font-black text-sm ${slot.isBlocked ? 'line-through text-red-700' : ''}`}>
                                  {slot.label || slot.time}
                                </span>
                                <span className={`text-[9px] font-bold ${
                                  newTime === slot.time ? 'text-cyan-200' : slot.isBlocked ? 'text-red-600 font-extrabold' : !slot.available ? 'text-gray-400' : 'text-emerald-600'
                                }`}>
                                  {slot.isBlocked ? '🚫 Cancelado' : slot.isPast ? 'Pasado' : slot.isBooked ? 'Ocupado' : 'Disponible'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tarde */}
                      {availableSlots.some(s => s.period === 'afternoon' || s.time >= '12:00') && (
                        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-900 uppercase tracking-wider mb-1.5">
                            <Sunset className="w-3.5 h-3.5 text-blue-600" />
                            <span>Jornada Tarde</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableSlots.filter(s => s.period === 'afternoon' || s.time >= '12:00').map((slot) => (
                              <button
                                key={slot.time}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => setNewTime(slot.time)}
                                title={slot.isBlocked ? `Cancelado por el administrador: ${slot.blockReason}` : ''}
                                className={`py-2 px-2 rounded-xl text-xs font-black transition text-center flex flex-col items-center justify-center ${
                                  newTime === slot.time
                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-cyan-400'
                                    : !slot.available
                                    ? slot.isBlocked
                                      ? 'bg-red-50 text-red-500 border border-red-200 cursor-not-allowed opacity-80'
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 opacity-60'
                                    : 'bg-white hover:bg-blue-50 text-gray-900 border-2 border-gray-200'
                                }`}
                              >
                                <span className={`font-black text-sm ${slot.isBlocked ? 'line-through text-red-700' : ''}`}>
                                  {slot.label || slot.time}
                                </span>
                                <span className={`text-[9px] font-bold ${
                                  newTime === slot.time ? 'text-cyan-200' : slot.isBlocked ? 'text-red-600 font-extrabold' : !slot.available ? 'text-gray-400' : 'text-emerald-600'
                                }`}>
                                  {slot.isBlocked ? '🚫 Cancelado' : slot.isPast ? 'Pasado' : slot.isBooked ? 'Ocupado' : 'Disponible'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-900 mb-1">
                    Motivo o Comentario (Opcional)
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Ej. Cambio por disponibilidad laboral"
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    className="w-full p-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-sm resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setActionView('')}
                    className="px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-xs font-black"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!newTime || submitting}
                    onClick={handleConfirmReschedule}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm shadow-md transition disabled:opacity-50"
                  >
                    {submitting ? 'Guardando nuevo horario...' : 'Confirmar Nuevo Horario'}
                  </button>
                </div>
              </div>
            )}

            {/* CANCEL VIEW */}
            {actionView === 'cancel' && (
              <div className="space-y-4">
                <button
                  onClick={() => setActionView('')}
                  className="inline-flex items-center gap-1 text-xs font-black text-gray-700 hover:text-black"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a detalles
                </button>

                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl">
                  <h4 className="font-black text-red-900 text-sm">¿Deseas cancelar esta cita?</h4>
                  <p className="text-xs text-red-700 mt-1 font-semibold">
                    Esta acción liberará el cupo de horario reservado para <strong>{appointment.service_name}</strong> el {appointment.appointment_date} a las {appointment.appointment_time}.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-900 mb-1">
                    Motivo de la cancelación (Opcional)
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Cuéntanos el motivo por el cual no podrás asistir..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    className="w-full p-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-xs resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setActionView('')}
                    className="px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-xs font-black"
                  >
                    No, mantener cita
                  </button>
                  <button
                    disabled={submitting}
                    onClick={handleConfirmCancel}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm shadow-md transition"
                  >
                    {submitting ? 'Cancelando...' : 'Sí, Cancelar Cita Definitivamente'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
