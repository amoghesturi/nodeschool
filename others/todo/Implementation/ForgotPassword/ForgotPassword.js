var request = require('request');
var ejs = require('ejs');
var path = require('path');
var log = require('../../Configuration/BunyanConfig').log;
var queryExecute = require('../Database/QueryExecute');
var sendPasswordEmail = require('./SendPasswordEmail');
var verifyLink = require('./VerifyLink');
var updateNewPassword = require('./UpdateNewPassword');

// Check the type. If forgot password, generate code and send an email
// Main function of the Implementation
module.exports = function(request, response) {

  var email = request.query.email;
  if(email) {
    email = email.toLowerCase();
  }
  var rtype = request.query.rtype;
  log.info({user : email}, 'ForgotPassword - Received request')
  var bindingParams = {
    email : email,
    rtype : rtype,
    request : request,
    response : response,
    keys : undefined
  }
  if(rtype == 'sendEmail') {
    sendPasswordEmail(bindingParams);
  }
  else if(rtype == 'confirm') {
    verifyLink(bindingParams);
  }
  else if(rtype == 'newPassword') {
    updateNewPassword(bindingParams);
  }
}
