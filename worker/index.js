const FROM = { email: 'website@w28.construction', name: 'W28 Construction Website' };
const LIMITS = { name: 100, email: 200, phone: 40, message: 5000 };

function field(form, key) {
  return String(form.get(key) || '').trim();
}

async function handleContact(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: 'Invalid form submission.' }, { status: 400 });
  }

  // Honeypot: real visitors never see or fill this field.
  if (field(form, 'company')) return Response.json({ ok: true });

  const data = {
    name: field(form, 'name'),
    email: field(form, 'email'),
    phone: field(form, 'phone'),
    message: field(form, 'message'),
  };

  if (!data.name || !data.email || !data.message) {
    return Response.json({ ok: false, error: 'Please fill in your name, email and project details.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return Response.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if (data[key].length > max) {
      return Response.json({ ok: false, error: `Your ${key} is too long.` }, { status: 400 });
    }
  }

  if (!env.CONTACT_TO) {
    console.error('CONTACT_TO secret is not set');
    return Response.json({ ok: false, error: 'The form is not set up yet. Please call or email us instead.' }, { status: 500 });
  }

  const text = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone || '-'}`,
    '',
    data.message,
  ].join('\n');

  try {
    await env.EMAIL.send({
      from: FROM,
      to: env.CONTACT_TO,
      replyTo: { email: data.email, name: data.name },
      subject: `New quote request from ${data.name.replace(/[\r\n]+/g, ' ')}`,
      text,
    });
  } catch (err) {
    console.error('Contact email failed', err.code, err.message);
    return Response.json({ ok: false, error: 'Sorry, your message could not be sent. Please call or email us instead.' }, { status: 502 });
  }

  return Response.json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
      }
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
