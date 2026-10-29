const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

export function validateEnquiry(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid enquiry data.');
  }

  const enquiry = {
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    email: typeof payload.email === 'string' ? payload.email.trim() : '',
    phone: typeof payload.phone === 'string' ? payload.phone.trim() : '',
    subject: typeof payload.subject === 'string' ? payload.subject.trim() : '',
    message: typeof payload.message === 'string' ? payload.message.trim() : '',
    consent: payload.consent === 'on' || payload.consent === true
  };

  if (enquiry.name.length < 2 || enquiry.name.length > 120) throw new Error('Enter your full name.');
  if (enquiry.email.length > 254 || !EMAIL_PATTERN.test(enquiry.email)) throw new Error('Enter a valid email address.');
  if (!PHONE_PATTERN.test(enquiry.phone)) throw new Error('Enter a 10-digit mobile number.');
  if (enquiry.subject.length < 3 || enquiry.subject.length > 200) throw new Error('Enter a subject.');
  if (enquiry.message.length < 10 || enquiry.message.length > 5000) throw new Error('Write a message between 10 and 5,000 characters.');
  if (!enquiry.consent) throw new Error('Consent is required to send the enquiry.');

  return enquiry;
}

export async function sendEnquiryToAppsScript(enquiry, { url, token, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...enquiry, webhookToken: token })
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The enquiry service returned an invalid response.');
  }

  if (!response.ok || result?.ok !== true || result.sheetSaved !== true) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'The enquiry could not be saved.');
  }

  return { sheetSaved: true, emailSent: result.emailSent === true };
}
