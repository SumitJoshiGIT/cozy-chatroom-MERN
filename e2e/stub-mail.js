// Preloaded into the server under test: captures OTP emails in a file instead
// of sending them, so sign-up can run end to end with no SMTP account.
const fs = require('fs');
const Module = require('module');
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request !== 'nodemailer') return load.call(this, request, ...rest);
  return {
    createTransport: () => ({
      sendMail: async ({ to, text }) => fs.appendFileSync(process.env.OTP_FILE, `${to} ${text}\n`),
    }),
  };
};
