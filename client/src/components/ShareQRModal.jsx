import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Download, QrCode, MessageCircle, Smartphone, Globe, Edit3, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ShareQRModal({ settings, onClose }) {
  const [copied, setCopied] = useState(false);
  const [networkIp, setNetworkIp] = useState('192.168.1.40');
  const [customUrl, setCustomUrl] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const qrRef = useRef(null);

  // Fetch local Wi-Fi IP from backend
  useEffect(() => {
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
          setNetworkIp(data.ip);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-detect public cloud domain or local Wi-Fi IP
  const isCloudHosted = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.startsWith('192.168.') &&
    !window.location.hostname.startsWith('10.');

  const defaultUrl = isCloudHosted
    ? `${window.location.origin}/citas`
    : `http://${networkIp}:5000/citas`;

  const activeUrl = customUrl.trim() || defaultUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 1000;
    canvas.height = 1000;

    img.onload = () => {
      // White background for universal QR scanner compatibility
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 100, 100, 800, 800);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR-ZipaquiraEnterprise-citas.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const whatsappMessage = encodeURIComponent(
    `¡Hola! Agenda tu cita en Zipaquirá Enterprise directamente aquí: ${activeUrl}`
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in text-gray-900">
      <div className="relative w-full max-w-md bg-[#0a0f22] text-white rounded-3xl shadow-2xl overflow-hidden border border-blue-500/50 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-black px-6 py-5 text-white flex items-center justify-between border-b border-blue-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Código QR para Celulares</h2>
              <p className="text-[11px] text-cyan-300 font-mono font-bold">Zipaquirá Enterprise</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          
          {/* Helpful Wi-Fi scan notice */}
          <div className="p-3 bg-blue-950/70 border border-blue-500/30 rounded-2xl text-[11px] text-blue-200 text-left flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">¿Por qué este enlace?</span>
              Los celulares no pueden abrir "localhost" porque localhost apunta al mismo celular. Este QR usa la IP de tu computador (<strong className="text-cyan-300">{networkIp}:5000</strong>) para que tu teléfono abra la página al instante en el mismo Wi-Fi.
            </div>
          </div>

          {/* HIGH CONTRAST QR CODE (BLACK ON WHITE FOR 100% SCANNER SUCCESS) */}
          <div 
            ref={qrRef}
            className="inline-block p-4 sm:p-5 bg-white rounded-3xl shadow-[0_0_35px_rgba(37,99,235,0.4)] border-4 border-blue-500"
          >
            <QRCodeSVG
              value={activeUrl}
              size={220}
              level="H"
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
            <div className="text-[11px] font-black font-mono text-gray-900 tracking-wider mt-1">
              ZIPAQUIRÁ ENTERPRISE
            </div>
          </div>

          {/* Current URL Bar with quick edit toggle */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-bold uppercase">Enlace que abre el QR:</span>
              <button
                type="button"
                onClick={() => setIsEditingUrl(!isEditingUrl)}
                className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingUrl ? 'Ocultar editor' : 'Cambiar enlace'}</span>
              </button>
            </div>

            {isEditingUrl ? (
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder={`http://${networkIp}:5000/citas o https://tudominio.com`}
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border-2 border-cyan-400 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400 block">
                  * Puedes escribir un dominio público o la IP de tu red.
                </span>
              </div>
            ) : (
              <div className="bg-[#060918] border border-blue-500/40 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-inner">
                <div className="px-2 truncate flex-1">
                  <span className="text-xs font-black text-cyan-300 font-mono truncate block">
                    {activeUrl}
                  </span>
                </div>

                <button
                  onClick={handleCopy}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md flex-shrink-0 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleDownloadQR}
              className="py-3 px-4 rounded-xl border border-blue-900 bg-blue-950/60 hover:bg-blue-900 text-white font-black text-xs flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Descargar PNG</span>
            </button>

            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
              className="py-3 px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-green-600/30"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          </div>

        </div>

      </div>
    </div>
  );
}
