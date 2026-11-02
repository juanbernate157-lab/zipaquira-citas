import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, User, Mail, Phone, FileText, Sparkles, Share2, Sun, Sunset, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BookingModal({ service, settings, onClose, onBookingSuccess }) {
  const [step, setStep] = useState(1); // 1: Date & Time, 2: Client Info, 3: Success
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');

  // Client form fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [googleCalUrl, setGoogleCalUrl] = useState('');
  const [adminWhatsappUrl, setAdminWhatsappUrl] = useState('');
  const [icsDownloadUrl, setIcsDownloadUrl] = useState('');

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate || !service) return;

    setLoadingSlots(true);
    setSlotError('');
    setSelectedTime('');

    fetch(`/api/appointments/available-slots?date=${selectedDate}&duration=${service.duration_minutes || 30}`)
      .then((res) => res.json())
      .then((data) => {
        setLoadingSlots(false);
        if (data.available === false) {
          setSlotError(data.message || 'Horario no disponible para esta fecha.');
          setAvailableSlots([]);
        } else {
          setAvailableSlots(data.slots || []);
        }
      })
      .catch((err) => {
        setLoadingSlots(false);
        setSlotError('Error cargando los horarios disponibles. Intenta de nuevo.');
      });
  }, [selectedDate, service]);

  // Handle booking form submission
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim()) {
      setSubmitError('Por favor completa todos los campos obligatorios.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: service.id,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          client_notes: clientNotes,
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        setSubmitError(data.error || 'Ocurrió un error al agendar la cita.');
        return;
      }

      setConfirmedBooking(data.appointment);
      setGoogleCalUrl(data.google_calendar_url || '');
      setAdminWhatsappUrl(data.admin_whatsapp_url || '');
      setIcsDownloadUrl(data.ics_url || `/api/appointments/${data.appointment.code}/ics`);
      setStep(3); // Success step

      // Celebrate with confetti
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#06b6d4', '#3b82f6', '#10b981'],
        });
      } catch (e) {
        // Confetti fallback
      }

      if (onBookingSuccess) {
        onBookingSuccess(data.appointment);
      }
    } catch (err) {
      setSubmitting(false);
      setSubmitError('No se pudo conectar con el servidor.');
    }
  };

  // Quick dates (Today, Tomorrow, Day after)
  const getQuickDates = () => {
    const dates = [];
    const labels = ['Hoy', 'Mañana', 'Pasado mañana'];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
      dates.push({
        iso,
        label: i < 3 ? labels[i] : dayName,
        dayName,
      });
    }
    return dates;
  };

  const currencySymbol = settings?.currency_symbol || '$';
  const currencyCode = settings?.currency_code || 'COP';
  const priceFormatted = `${currencySymbol} ${Number(service.price).toLocaleString()} ${currencyCode}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in text-gray-900">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-500/40 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-[#070b19] px-6 py-5 text-white flex items-center justify-between border-b border-blue-800/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase text-cyan-400">
                Paso {step} de 3
              </span>
              <span className="text-blue-400">•</span>
              <span className="text-xs font-bold text-gray-300">
                {step === 1 ? 'Fecha y Horario' : step === 2 ? 'Tus Datos' : '¡Cita Confirmada!'}
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 line-clamp-1">
              {service.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Service Mini Banner */}
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between text-xs sm:text-sm font-bold text-blue-950">
          <span className="flex items-center gap-1.5 text-blue-900">
            <Clock className="w-4 h-4 text-blue-600" />
            Duración: {service.duration_minutes} min
          </span>
          <span className="text-blue-700 font-black text-base">
            {priceFormatted}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          
          {/* STEP 1: Select Date & Time */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-gray-900 mb-2">
                  1. Selecciona la Fecha
                </label>
                
                {/* Quick Date Chips */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                  {getQuickDates().map((item) => (
                    <button
                      key={item.iso}
                      type="button"
                      onClick={() => setSelectedDate(item.iso)}
                      className={`p-2.5 rounded-2xl text-center border transition-all ${
                        selectedDate === item.iso
                          ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                          : 'border-gray-300 bg-gray-50 hover:bg-blue-50 text-gray-800 font-semibold'
                      }`}
                    >
                      <span className="block text-xs font-black capitalize">{item.label}</span>
                      <span className={`block text-[11px] ${selectedDate === item.iso ? 'text-blue-100' : 'text-gray-500'}`}>
                        {item.dayName}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Date Input for Other Dates */}
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm"
                  />
                </div>
              </div>

              {/* Time Slots: Horarios Exclusivos RUFO Precise Detailing (8-9 AM y 2-3 PM) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-black text-gray-900">
                    2. Selecciona la Hora de Atención
                  </label>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Turnos Exclusivos
                  </span>
                </div>

                {loadingSlots ? (
                  <div className="py-8 text-center text-gray-600 text-sm flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="font-bold">Calculando turnos disponibles...</span>
                  </div>
                ) : slotError ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-start gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{slotError}</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-6 text-center text-gray-600 font-bold text-sm bg-gray-100 rounded-2xl border border-gray-200">
                    No hay turnos disponibles para esta fecha. Intenta seleccionando otro día.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Jornada Mañana */}
                    {availableSlots.some(s => s.period === 'morning' || s.time < '12:00') && (
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 uppercase tracking-wider mb-2">
                          <Sun className="w-3.5 h-3.5 text-amber-600" />
                          <span>Jornada Mañana</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {availableSlots.filter(s => s.period === 'morning' || s.time < '12:00').map((slot) => {
                            const isSelected = selectedTime === slot.time;
                            const isDisabled = !slot.available;
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setSelectedTime(slot.time)}
                                title={slot.isBlocked ? `Cancelado por el administrador: ${slot.blockReason}` : ''}
                                className={`py-2.5 px-3 rounded-xl text-sm font-black transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-cyan-400 scale-[1.02]'
                                    : isDisabled
                                    ? slot.isBlocked
                                      ? 'bg-red-50 text-red-500 border border-red-200 cursor-not-allowed opacity-80'
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 opacity-70'
                                    : 'bg-white hover:bg-blue-50 text-gray-900 border-2 border-gray-200 hover:border-blue-400 shadow-sm'
                                }`}
                              >
                                <span className={`text-base font-black ${slot.isBlocked ? 'line-through text-red-700' : ''}`}>
                                  {slot.label || slot.time}
                                </span>
                                <span className={`text-[10px] font-bold ${
                                  isSelected ? 'text-cyan-200' : slot.isBlocked ? 'text-red-600 font-extrabold' : isDisabled ? 'text-gray-400' : 'text-emerald-600'
                                }`}>
                                  {slot.isBlocked ? '🚫 Cancelado' : slot.isPast ? 'Pasado' : slot.isBooked ? 'Ocupado' : 'Disponible'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Jornada Tarde */}
                    {availableSlots.some(s => s.period === 'afternoon' || s.time >= '12:00') && (
                      <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 text-xs font-black text-blue-900 uppercase tracking-wider mb-2">
                          <Sunset className="w-3.5 h-3.5 text-blue-600" />
                          <span>Jornada Tarde</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {availableSlots.filter(s => s.period === 'afternoon' || s.time >= '12:00').map((slot) => {
                            const isSelected = selectedTime === slot.time;
                            const isDisabled = !slot.available;
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setSelectedTime(slot.time)}
                                title={slot.isBlocked ? `Cancelado por el administrador: ${slot.blockReason}` : ''}
                                className={`py-2.5 px-3 rounded-xl text-sm font-black transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-cyan-400 scale-[1.02]'
                                    : isDisabled
                                    ? slot.isBlocked
                                      ? 'bg-red-50 text-red-500 border border-red-200 cursor-not-allowed opacity-80'
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 opacity-70'
                                    : 'bg-white hover:bg-blue-50 text-gray-900 border-2 border-gray-200 hover:border-blue-400 shadow-sm'
                                }`}
                              >
                                <span className={`text-base font-black ${slot.isBlocked ? 'line-through text-red-700' : ''}`}>
                                  {slot.label || slot.time}
                                </span>
                                <span className={`text-[10px] font-bold ${
                                  isSelected ? 'text-cyan-200' : slot.isBlocked ? 'text-red-600 font-extrabold' : isDisabled ? 'text-gray-400' : 'text-emerald-600'
                                }`}>
                                  {slot.isBlocked ? '🚫 Cancelado' : slot.isPast ? 'Pasado' : slot.isBooked ? 'Ocupado' : 'Disponible'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Next step button */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">
                  {selectedTime ? `Horario: ${selectedDate} a las ${selectedTime}` : 'Selecciona un turno para continuar'}
                </span>
                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => setStep(2)}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black transition ${
                    selectedTime
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Client Info & Confirm (With 100% visible text) */}
          {step === 2 && (
            <form onSubmit={handleSubmitBooking} className="space-y-4">
              {submitError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs sm:text-sm flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Summary Pill */}
              <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-200 text-xs sm:text-sm text-blue-950 flex items-center justify-between font-bold">
                <div>
                  <span className="block text-gray-900">{service.name}</span>
                  <span className="text-blue-700">{selectedDate} a las {selectedTime}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-black text-blue-600 hover:underline"
                >
                  Cambiar Turno
                </button>
              </div>

              {/* NOMBRE COMPLETO */}
              <div>
                <label className="block text-xs font-black text-gray-900 mb-1 uppercase tracking-wide">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-gray-400 shadow-sm"
                  />
                </div>
              </div>

              {/* CORREO ELECTRÓNICO */}
              <div>
                <label className="block text-xs font-black text-gray-900 mb-1 uppercase tracking-wide">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-gray-400 shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-gray-600 font-semibold mt-1">
                  ✉️ Te enviaremos la confirmación, opciones de aplazar/cancelar y recordatorio 30 min antes.
                </p>
              </div>

              {/* TELÉFONO / WHATSAPP */}
              <div>
                <label className="block text-xs font-black text-gray-900 mb-1 uppercase tracking-wide">
                  Teléfono / WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+57 300 123 4567"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-gray-400 shadow-sm"
                  />
                </div>
              </div>

              {/* NOTAS O SOLICITUDES ESPECIALES */}
              <div>
                <label className="block text-xs font-black text-gray-900 mb-1 uppercase tracking-wide">
                  Notas o Solicitudes Especiales (Opcional)
                </label>
                <textarea
                  rows="2"
                  placeholder="¿Alguna indicación previa o requerimiento?"
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  className="w-full p-3 rounded-xl border-2 border-gray-300 text-gray-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-gray-400 resize-none shadow-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-full border-2 border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-black flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 px-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-xl shadow-blue-600/30 transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Agendando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Reserva ({priceFormatted})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Booking Success */}
          {step === 3 && confirmedBooking && (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  ¡Cita Agendada con Éxito!
                </h3>
                <p className="text-sm text-gray-600 mt-1 font-semibold">
                  Hola <strong className="text-gray-900 font-black">{confirmedBooking.client_name}</strong>, tu reserva ha quedado registrada en el sistema.
                </p>
              </div>

              {/* Ticket Card */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 text-left space-y-2.5 text-sm shadow-sm font-semibold">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="text-gray-500 font-bold">Código de Cita:</span>
                  <span className="font-mono font-black text-blue-600 text-base">{confirmedBooking.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">Servicio:</span>
                  <span className="font-black text-gray-900">{confirmedBooking.service_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">Fecha y Hora:</span>
                  <span className="font-black text-blue-900">{confirmedBooking.appointment_date} a las {confirmedBooking.appointment_time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">Valor:</span>
                  <span className="font-black text-green-700 text-base">{priceFormatted}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">Lugar:</span>
                  <span className="text-gray-800 text-xs text-right max-w-[200px]">{settings?.address || 'Calle 5 # 10-25'}, {settings?.city}</span>
                </div>
              </div>

              {/* Automated Notification Status to Business */}
              <div className="bg-gradient-to-r from-emerald-50 via-emerald-100/40 to-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-left space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-1.5">
                      <span>Notificación Enviada al Administrador</span>
                      <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full">Automático</span>
                    </h4>
                    <p className="text-[11px] text-emerald-800 font-medium">
                      El administrador (Pedrito) ya ha recibido los detalles de tu cita. No necesitas enviar confirmaciones adicionales.
                    </p>
                  </div>
                </div>

                <div className="pt-1 border-t border-emerald-200">
                  <a
                    href={`https://wa.me/${(settings?.whatsapp || settings?.phone || '573006042818').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, acabo de agendar una cita en RUFO Precise Detailing con el codigo ${confirmedBooking.code} para ${confirmedBooking.service_name}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>¿Tienes alguna pregunta? Chatear con nosotros por WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Calendar Automation Card with 30m Reminder */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-400 rounded-2xl p-4 text-left space-y-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md animate-pulse">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-blue-950 flex items-center gap-1.5">
                      <span>Recordatorio Automático en Google Calendar</span>
                      <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full">Activo</span>
                    </h4>
                    <p className="text-[11px] text-blue-800 font-bold">
                      ⏰ Alarma pre-configurada para sonar <strong>30 minutos antes</strong> de tu cita.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href={googleCalUrl || `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Cita: ${confirmedBooking.service_name} - ${settings?.business_name || 'RUFO Precise Detailing'}`)}&dates=${confirmedBooking.appointment_date.replace(/-/g, '')}T${confirmedBooking.appointment_time.replace(/:/g, '')}00/${confirmedBooking.appointment_date.replace(/-/g, '')}T${confirmedBooking.appointment_time.replace(/:/g, '')}00&details=${encodeURIComponent(`Cita para ${confirmedBooking.service_name}.\nCódigo: ${confirmedBooking.code}\nTeléfono: ${confirmedBooking.client_phone}\n\n* Recordatorio 30m antes.`)}&location=${encodeURIComponent(settings?.address || 'Zipaquirá')}&add=${encodeURIComponent(confirmedBooking.client_email || '')},${encodeURIComponent(settings?.contact_email || 'ru88foramirez@hotmail.com')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition text-center cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Abrir y Guardar en Google Calendar</span>
                  </a>

                  <a
                    href={icsDownloadUrl || `/api/appointments/${confirmedBooking.code}/ics`}
                    download={`cita-${confirmedBooking.code}.ics`}
                    className="py-3 px-4 rounded-xl border-2 border-blue-400 bg-white hover:bg-blue-50 text-blue-900 font-black text-xs flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <span>Descargar .ICS (Apple/Android)</span>
                  </a>
                </div>
              </div>

              {/* Notification Notice */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-xs text-green-950 text-left flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-black">Confirmación registrada para: {confirmedBooking.client_email}</p>
                  <p className="text-green-800 mt-0.5 font-medium">
                    Te enviaremos un recordatorio <strong>30 minutos antes</strong> de tu cita. Si necesitas aplazarla o cancelarla, puedes hacerlo desde el enlace de tu código <strong>{confirmedBooking.code}</strong>.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 px-4 rounded-full bg-gray-900 hover:bg-black text-white font-black text-xs transition shadow-md"
                >
                  Cerrar
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
