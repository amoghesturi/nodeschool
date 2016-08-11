var transporter = require('../../Configuration/NodeMailerConfig').transporter;
var fs = require('fs');
var ejs = require('ejs');
var log = require('../../Configuration/BunyanConfig').log;
var constants = require('../../Utils/Constants').constants;
var path = require('path');

module.exports=function(emailParams) {
  // render email from template file
  log.debug({"newUser":emailParams.email}, 'SendEmail - Rendering password reset email');
  var bindingParams = {
    emailParams : emailParams,
    passwordresetLink: constants.IP +'/forgotPassword?rtype=confirm&presetCode=' + emailParams.key1 + '-' + emailParams.key2
  };
  if(emailParams.userExists) {
    ejs.renderFile(path.join(__dirname, '../views/passwordLinkUserExists.html'), bindingParams,
      renderVerifyEmailComplete.bind(bindingParams));
  }
  else {
    ejs.renderFile(path.join(__dirname, '../views/passwordLinkUserDoesNotExist.html'), bindingParams,
      renderVerifyEmailComplete.bind(bindingParams));
  }
}

// This function is called after the renderign of email from html template has
// been completed
function renderVerifyEmailComplete(err, result) {
  var bindingParams = {
    emailParams : this.emailParams,
    passwordresetLink: this.passwordresetLink
  }
  if (!err) {
    composeMail(result, bindingParams);
  }
  else {
    log.error({"newUser":this.emailParams.email}, 'SendEmail - Error while rendering verification email. \n' + err);
    result = '<h3> Please Click the following link to verify your email </h3>' +
      '<p>' + this.passwordresetLink + '</p>';
    composeMail(result, bindingParams);
  }
}

// setup e-mail data with unicode symbols
function composeMail(html, params) {
  var bindingParams = {
    emailParams : params.emailParams,
    passwordresetLink: params.passwordresetLink
  }
  var mailOptions = {
    from: 'VeeV<no-reply@vimsel.com>', // sender address
    to: params.emailParams.email, // list of receivers
    subject: 'VeeV Password Reset', // Subject line
    text: '', // plaintext body
    //unique link is sent to users's email address. adding verification code
    //makes each link unique.
    html: html
  };
  log.info({"newUser":params.emailParams.email}, 'SendEmail - Sending email - \n' + mailOptions);
  // send mail with defined transport object
  // No need to recreate the transporter object. You can use
  // the same transporter object for all e-mails
  transporter.sendMail(mailOptions, sendmailCallback.bind(bindingParams));
}

// Callback function after sending the verification email
function sendmailCallback(error, info){
  if(error){
    log.error({"newUser":this.emailParams.email}, 'SendEmail - Error sending verification email. ' + error)
  }
  else {
    log.info({"newUser":this.emailParams.email}, 'SendEmail - Verification email sent Succesfully. ' + info.response);
  }
};
