var path = require('path');
var transporter = require('../../Configuration/NodeMailerConfig').transporter;
var fs = require('fs');
var ejs = require('ejs');
var log = require('../../Configuration/BunyanConfig').log;
var constants = require('../../Utils/Constants').constants;

// Sends out email with verification link to verify user's email address
// This function is called after the user registration was successful and the
// user was added to the database.
module.exports=function(credentials) {
  // render email from template file
  log.debug(credentials);
  log.debug({"newUser":credentials[1]}, 'sendVerificationMail - Rendering verification email');
  var bindingParams = {
    credentials : credentials,
    activationLink: constants.IP +
          '/validatemyemail?token='+credentials[3] +
          "&email=" + credentials[1]
  }
  ejs.renderFile(path.join(__dirname, '../views/verifyemail.html'), bindingParams,
    renderVerifyEmailComplete.bind(bindingParams));
}

// This function is called after the rendering of email from html template has
// been completed
function renderVerifyEmailComplete(err, result) {
  var bindingParams = {
    credentials : this.credentials,
    activationLink: this.activationLink
  }
  if (!err) {
    composeMail(result, bindingParams);
  }
  else {
    log.error({"newUser":this.credentials[1]}, 'sendVerificationMail - Error while rendering verification email. \n' + err);
    result = '<h3> Please Click the following link to verify your email </h3>' +
      '<p>' + this.activationLink + '</p>';
    composeMail(result, bindingParams);
  }
}

// setup e-mail data with unicode symbols
function composeMail(html, params) {
  var bindingParams = {
    credentials : params.credentials,
    activationLink: params.activationLink
  }
  var mailOptions = {
    from: 'VeeV<no-reply@vimsel.com>', // sender address
    to: params.credentials[1], // list of receivers
    subject: 'Welcome to VeeV', // Subject line
    text: '', // plaintext body
    //unique link is sent to users's email address. adding verification code
    //makes each link unique.
    html: html
  };
  log.info({"newUser":params.credentials[1]}, 'SendVerificationMail - Sending email - \n' + mailOptions);
  // send mail with defined transport object
  // No need to recreate the transporter object. You can use
  // the same transporter object for all e-mails
  console.log(transporter);
  transporter.sendMail(mailOptions, sendmailCallback.bind(bindingParams));
}

// Callback function after sending the verification email
function sendmailCallback(error, info){
  if(error){
    log.error({"newUser":this.credentials[1]}, 'SendVerificationMail - Error sending verification email. ' + error)
  }
  else {
    log.info({"newUser":this.credentials[1]}, 'SendVerificationMail - Verification email sent Succesfully. ' + info.response);
  }
};
