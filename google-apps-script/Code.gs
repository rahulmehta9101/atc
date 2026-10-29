const SPREADSHEET_ID = '1jSqm1PXWenvS3RzabQy7fioYuxfNfUUAlZXBv9O3VRU';
const SHEET_NAME = 'Enquiries';
const RECIPIENT = 'dme@abhaytrading.in';
const TOKEN_PROPERTY = 'WEBHOOK_TOKEN';

function doPost(event) {
  try {
    const data = JSON.parse(event.postData.contents);
    const expectedToken = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
    if (!expectedToken || data.webhookToken !== expectedToken) {
      return json({ ok: false, error: 'The enquiry service is not authorized.' });
    }

    const enquiry = validate(data);
    const sheet = getEnquirySheet();
    const receivedAt = new Date();
    sheet.appendRow([
      receivedAt,
      safeCell(enquiry.name),
      safeCell(enquiry.email),
      safeCell(enquiry.phone),
      safeCell(enquiry.subject),
      safeCell(enquiry.message),
      'Yes'
    ]);

    let emailSent = true;
    try {
      MailApp.sendEmail({
        to: RECIPIENT,
        subject: 'Website enquiry: ' + enquiry.subject,
        body: [
          'A new enquiry was submitted on the Abhay Trading Co. website.',
          '',
          'Name: ' + enquiry.name,
          'Email: ' + enquiry.email,
          'Mobile: ' + enquiry.phone,
          'Subject: ' + enquiry.subject,
          '',
          'Message:',
          enquiry.message
        ].join('\n'),
        replyTo: enquiry.email
      });
    } catch (error) {
      console.error('Enquiry saved, but notification email failed: ' + error.message);
      emailSent = false;
    }

    return json({ ok: true, sheetSaved: true, emailSent: emailSent });
  } catch (error) {
    console.error('Enquiry processing failed: ' + error.message);
    return json({ ok: false, error: error.message || 'Unable to process the enquiry.' });
  }
}

function validate(data) {
  const enquiry = {
    name: String(data.name || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    subject: String(data.subject || '').trim(),
    message: String(data.message || '').trim(),
    consent: data.consent === 'on' || data.consent === true
  };

  if (enquiry.name.length < 2 || enquiry.name.length > 120) throw new Error('Enter your full name.');
  if (enquiry.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) throw new Error('Enter a valid email address.');
  if (!/^\d{10}$/.test(enquiry.phone)) throw new Error('Enter a 10-digit mobile number.');
  if (enquiry.subject.length < 3 || enquiry.subject.length > 200) throw new Error('Enter a subject.');
  if (enquiry.message.length < 10 || enquiry.message.length > 5000) throw new Error('Write a message between 10 and 5,000 characters.');
  if (!enquiry.consent) throw new Error('Consent is required to send the enquiry.');

  return enquiry;
}

function getEnquirySheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(['Received at', 'Name', 'Email', 'Mobile', 'Subject', 'Message', 'Consent']);
  }
  return sheet;
}

function safeCell(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
