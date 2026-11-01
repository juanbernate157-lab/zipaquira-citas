import React, { useState, useEffect } from 'react';
import { X, Mail, RefreshCw, Send, CheckCircle2, Clock, AlertCircle, Eye } from 'lucide-react';

export default function EmailLogsModal({ onClose, adminEmail }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/emails/logs')
      .then((res) => res.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTestEmail = async () => {
    setTestSending(true);
    setTestMessage('');
    try {
      const res = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: adminEmail }),
      });
      const data = await res.json();
      setTestSending(false);
      if (res.ok) {
        setTestMessage(data.message || 'Correo de prueba enviado con éxito.');
        fetchLogs();
      } else {
        setTestMessage('Error: ' + (data.error || 'No se pudo enviar'));
      }
    } catch (e) {
      setTestSending(false);
      setTestMessage('Error de red al enviar el correo de prueba.');
    }
  };

  const typeLabels = {
    confirmation: { label: 'Confirmación Cliente', bg: 'bg-green-100 text-green-800' },
    admin_notification: { label: 'Alerta al Admin', bg: 'bg-purple-100 text-purple-800' },
    reminder_30m: { label: 'Recordatorio 30 Min', bg: 'bg-amber-100 text-amber-800' },
    rescheduled: { label: 'Reagendamiento', bg: 'bg-blue-100 text-blue-800' },
    cancelled: { label: 'Cancelación', bg: 'bg-red-100 text-red-800' },
    test: { label: 'Prueba', bg: 'bg-gray-100 text-gray-800' },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-lg font-bold">Buzón de Notificaciones y Registro de Correos</h2>
              <p className="text-xs text-gray-400">Historial de correos enviados al cliente y administrador con vista previa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <span className="text-xs text-gray-500 font-medium">
              {logs.length} correos registrados
            </span>
          </div>

          <button
            onClick={handleSendTestEmail}
            disabled={testSending}
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testSending ? 'Enviando...' : 'Enviar Correo de Prueba'}</span>
          </button>
        </div>

        {testMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center justify-between">
            <span>{testMessage}</span>
            <button onClick={() => setTestMessage('')} className="text-purple-600 hover:text-purple-900">&times;</button>
          </div>
        )}

        {/* Content: List + Preview */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Logs List */}
          <div className="w-full md:w-1/2 overflow-y-auto border-r border-gray-200 p-4 space-y-2">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-400">Cargando registros...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Aún no hay correos en el registro. Cuando un cliente agende una cita, aquí verás las notificaciones enviadas.
              </div>
            ) : (
              logs.map((log) => {
                const badge = typeLabels[log.email_type] || { label: log.email_type, bg: 'bg-gray-100 text-gray-700' };
                const isSelected = selectedEmail?.id === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedEmail(log)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition text-left ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/70 shadow-sm'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-gray-900 line-clamp-1 mb-0.5">
                      {log.subject}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Para: <strong className="text-gray-700">{log.to_email}</strong></span>
                      <span className={`font-semibold ${log.status === 'delivered' ? 'text-green-600' : 'text-blue-600'}`}>
                        {log.status === 'delivered' ? 'Enviado SMTP' : 'Simulado en App'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* HTML Preview Pane */}
          <div className="w-full md:w-1/2 p-4 bg-gray-100 overflow-y-auto flex flex-col">
            {selectedEmail ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex-1 flex flex-col overflow-hidden">
                <div className="border-b border-gray-200 pb-3 mb-3 text-xs space-y-1">
                  <div><span className="font-bold text-gray-600">Para:</span> {selectedEmail.to_email}</div>
                  <div><span className="font-bold text-gray-600">Asunto:</span> {selectedEmail.subject}</div>
                  <div><span className="font-bold text-gray-600">Fecha y Hora:</span> {new Date(selectedEmail.created_at).toLocaleString()}</div>
                  {selectedEmail.details && (
                    <div className="text-[11px] text-gray-400"><span className="font-bold">Detalle técnico:</span> {selectedEmail.details}</div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
                  <div
                    dangerouslySetInnerHTML={{ __html: selectedEmail.content_html }}
                    className="prose prose-sm max-w-none text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs p-6 text-center">
                <Eye className="w-8 h-8 text-gray-300 mb-2" />
                <span>Haz clic en un correo de la lista izquierda para ver la vista previa exacta que recibe el usuario.</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
