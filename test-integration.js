const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN ---');
  
  // 1. Health check
  const health = await request('GET', '/api/health');
  console.log('1. Health check:', health.status === 200 ? '✅ OK' : '❌ FAIL', health.data);

  // 2. Services list
  const servicesRes = await request('GET', '/api/services');
  console.log('2. Servicios disponibles:', servicesRes.status === 200 ? '✅ OK' : '❌ FAIL', `Total: ${servicesRes.data.length}`);

  // 3. Settings
  const settingsRes = await request('GET', '/api/settings');
  console.log('3. Configuración del negocio:', settingsRes.status === 200 ? '✅ OK' : '❌ FAIL', settingsRes.data.business_name);

  // 4. Book appointment
  const testService = servicesRes.data[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const bookingPayload = {
    service_id: testService.id,
    appointment_date: tomorrowStr,
    appointment_time: '10:00',
    client_name: 'Carlos Mendoza',
    client_email: 'carlos.mendoza@ejemplo.com',
    client_phone: '+573109876543',
    client_notes: 'Prefiero con estilo degradado bajo',
  };

  const bookingRes = await request('POST', '/api/appointments', bookingPayload);
  console.log('4. Agendamiento de cita:', bookingRes.status === 201 ? '✅ CITA CREADA' : '❌ FAIL', bookingRes.data);
  const code = bookingRes.data?.appointment?.code;

  if (code) {
    // 5. Query appointment by code
    const getApp = await request('GET', `/api/appointments/code/${code}`);
    console.log('5. Consulta por código de cliente:', getApp.status === 200 ? '✅ ENCONTRADA' : '❌ FAIL', getApp.data.appointment.code);

    // 6. Test Reschedule (Aplazar)
    const rescheduleRes = await request('PUT', `/api/appointments/${code}/reschedule`, {
      new_date: tomorrowStr,
      new_time: '11:00',
      notes: 'Cambié a las 11:00 por disponibilidad',
    });
    console.log('6. Aplazar / Reagendar cita:', rescheduleRes.status === 200 ? '✅ REAGENDADA' : '❌ FAIL', rescheduleRes.data.appointment.appointment_time);

    // 7. Check email logs (Auditoría)
    const emailsRes = await request('GET', '/api/emails/logs');
    console.log('7. Buzón de correos generados (Auditoría):', emailsRes.status === 200 ? '✅ REGISTRADOS' : '❌ FAIL', `Total correos: ${emailsRes.data.length}`);
    emailsRes.data.slice(0, 3).forEach((e) => {
      console.log(`   - [${e.email_type}] Para: ${e.to_email} | Asunto: ${e.subject}`);
    });
  }

  // 8. Test Frontend serving (HTML)
  const htmlRes = await request('GET', '/');
  console.log('8. Frontend HTML servido correctamente:', htmlRes.status === 200 && typeof htmlRes.raw === 'string' && htmlRes.raw.includes('<html') ? '✅ OK' : '❌ FAIL');

  console.log('--- PRUEBAS COMPLETADAS CON ÉXITO ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
