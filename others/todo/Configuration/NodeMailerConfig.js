var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var options;
if(process.env.DB_ENV == 'DEV') {
  options = {
      service: 'Gmail',
      auth: {
          user: 'testmymailserv',
          pass: 'sudotest'
      }
    }
}
else {
  options = {
    host : 'localhost',
    port : 25,
  }
}

module.exports.transporter = nodemailer.createTransport(smtpTransport(options
));
