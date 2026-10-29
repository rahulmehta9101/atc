import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendEnquiryToAppsScript, validateEnquiry } from './enquiry.mjs';

const validPayload = {
  name: 'A Buyer',
  email: 'buyer@example.com',
  phone: '9876543210',
  subject: 'Yarn enquiry',
  message: 'Please share the available yarn counts.',
  consent: 'on'
};

test('requires a 10-digit mobile number and consent before forwarding an enquiry', () => {
  assert.equal(validateEnquiry(validPayload).phone, validPayload.phone);
  for (const phone of ['', '987654321', '98765432101', '+919876543210', '98765 43210']) {
    assert.throws(() => validateEnquiry({ ...validPayload, phone }), /10-digit mobile number/);
  }
  assert.throws(() => validateEnquiry({ ...validPayload, consent: '' }), /Consent is required/);
});

test('forwards enquiries with the private token and reports partial email failure', async () => {
  let request;
  const result = await sendEnquiryToAppsScript(validateEnquiry(validPayload), {
    url: 'https://script.google.com/macros/s/test/exec',
    token: 'private-token',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return Response.json({ ok: true, sheetSaved: true, emailSent: false });
    }
  });

  assert.equal(request.url, 'https://script.google.com/macros/s/test/exec');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.body.webhookToken, 'private-token');
  assert.equal(request.body.phone, validPayload.phone);
  assert.deepEqual(result, { sheetSaved: true, emailSent: false });
});

test('does not report success when the Apps Script cannot save the sheet row', async () => {
  await assert.rejects(
    sendEnquiryToAppsScript(validateEnquiry(validPayload), {
      url: 'https://script.google.com/macros/s/test/exec',
      token: 'private-token',
      fetchImpl: async () => Response.json({ ok: false, error: 'Unable to save the enquiry.' })
    }),
    /Unable to save the enquiry/
  );
});
