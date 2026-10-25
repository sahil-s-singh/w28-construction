const FROM = { email: 'website@w28.construction', name: 'W28 Construction Website' };
const PUBLIC_EMAIL = { email: 'info@w28.construction', name: 'W28 Construction' };
// Wording promised to customers in the automatic reply email. Only keep it if you can meet it.
const REPLY_PROMISE = 'within one business day';

const LIMITS = {
  name: 100,
  email: 200,
  phone: 40,
  address: 200,
  project_type: 100,
  contact_method: 100,
  timing: 100,
  heard_from: 100,
  message: 5000,
  source: 300,
  landing_page: 300,
  device: 200,
  time_on_site: 50,
  sections_viewed: 1000,
  actions_taken: 2000,
};
const LABELS = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Property address',
  project_type: 'Project type',
  contact_method: 'Preferred contact method',
  timing: 'Preferred timing',
  heard_from: 'How they heard about us',
};
const JOURNEY_LABELS = {
  source: 'Source',
  landing_page: 'Landing page',
  device: 'Device',
  time_on_site: 'Time on site',
  sections_viewed: 'Sections viewed',
  actions_taken: 'Actions taken',
};

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function field(form, key) {
  return String(form.get(key) || '').trim();
}

function oneLine(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function readPhotos(form) {
  const files = [];
  for (let i = 1; i <= MAX_PHOTOS; i++) {
    const file = form.get('photo_' + i);
    if (file && typeof file === 'object' && file.size > 0) files.push(file);
  }
  if (files.some((file) => !PHOTO_TYPES.includes(file.type))) {
    return { error: 'Photos must be JPEG, PNG or WebP images.' };
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_PHOTO_BYTES) {
    return { error: 'Your photos are too large to send together (limit 5 MB).' };
  }
  const attachments = await Promise.all(files.map(async (file, index) => ({
    content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    filename: oneLine(file.name || '').slice(0, 100) || `photo-${index + 1}.jpg`,
    type: file.type,
    disposition: 'attachment',
  })));
  return { attachments };
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

  const data = {};
  for (const key of Object.keys(LIMITS)) data[key] = field(form, key);
  const wantsWalkthrough = field(form, 'walkthrough') === 'Yes';
  const leadId = /^[A-Z0-9-]{1,40}$/.test(field(form, 'lead_id')) ? field(form, 'lead_id') : `W28-${Date.now().toString(36).toUpperCase()}`;

  if (!data.name || !data.email || !data.message) {
    return Response.json({ ok: false, error: 'Please fill in your name, email and project details.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return Response.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if (data[key].length > max) {
      const label = (LABELS[key] || JOURNEY_LABELS[key] || key).toLowerCase();
      return Response.json({ ok: false, error: `Your ${label} is too long.` }, { status: 400 });
    }
  }

  const photos = await readPhotos(form);
  if (photos.error) return Response.json({ ok: false, error: photos.error }, { status: 400 });

  if (!env.CONTACT_TO) {
    console.error('CONTACT_TO secret is not set');
    return Response.json({ ok: false, error: 'The form is not set up yet. Please call or email us instead.' }, { status: 500 });
  }

  const lines = Object.entries(LABELS).map(([key, label]) => `${label}: ${data[key] || '-'}`);
  lines.push(`Free walkthrough requested: ${wantsWalkthrough ? 'Yes' : 'No'}`);
  lines.push(`Reference: ${leadId}`);
  lines.push(`Photos attached: ${photos.attachments.length}`);
  lines.push('', data.message);
  const journey = Object.entries(JOURNEY_LABELS).filter(([key]) => data[key]);
  if (journey.length) {
    lines.push('', '--- Visit details ---', ...journey.map(([key, label]) => `${label}: ${data[key]}`));
  }

  const subject = `${wantsWalkthrough ? 'Walkthrough + quote request' : 'Quote request'} from ${oneLine(data.name)} [${leadId}]`;

  try {
    await env.EMAIL.send({
      from: FROM,
      to: env.CONTACT_TO,
      replyTo: { email: data.email, name: data.name },
      subject,
      text: lines.join('\n'),
      attachments: photos.attachments.length ? photos.attachments : undefined,
    });
  } catch (err) {
    console.error('Contact email failed', err.code, err.message);
    return Response.json({ ok: false, error: 'Sorry, your message could not be sent. Please call or email us instead.' }, { status: 502 });
  }

  // Automatic reply to the customer. Sending to any address needs Cloudflare Email Sending
  // (Workers Paid, domain onboarded); until then this fails quietly and the request still succeeds.
  const firstName = oneLine(data.name).split(/\s+/)[0] || 'there';
  try {
    await env.EMAIL.send({
      from: FROM,
      to: { email: data.email, name: oneLine(data.name) },
      replyTo: PUBLIC_EMAIL,
      subject: `We've received your request [${leadId}]`,
      text: [
        `Hi ${firstName},`,
        '',
        `Thanks for contacting W28 Construction. We've received your request${wantsWalkthrough ? ' for a free walkthrough' : ''} and we'll reply ${REPLY_PROMISE}.`,
        '',
        `Your reference number: ${leadId}`,
        '',
        "If it's urgent, call us at (306) 858-3006.",
        '',
        'We Show Up. We Finish.',
        'W28 Construction | Saskatoon & Surrounding Areas',
        'https://www.w28.construction/',
      ].join('\n'),
    });
  } catch (err) {
    console.warn('Auto-reply not sent', err.code, err.message);
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
