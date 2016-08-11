var crypto= require('crypto'); // For generating random bytes
var validator = require('validator');// for email format validation
var sendVerificationMail = require('./Database/SendVerificationMail');
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var maxUsers = require('../Configuration/MiscConfig').maxUsers;

module.exports = function (request, response) {
  var bindingParams = {
    email : request.query.email.toLowerCase(),
    request : request,
    response : response
  }
  log.info({'resendEmail' : bindingParams.email}, 'ResendEmail - Received request to resend verification email');
  var queryParameters = [request.query.email.toLowerCase()];
  // checking if the user is already registered
  queryExecute('SELECT * FROM users WHERE email=$1', queryParameters, countUsersCallback.bind(bindingParams));
}

function countUsersCallback(result) {
  var bindingParams = {
    email : this.email,
    response : this.response,
    variables_insert : undefined
  }
  if(result.error) {
    log.error({'resendEmail' : bindingParams.email}, 'ResendEmail - Error while querying if the user exists' + result.error);
    JSONObj= {"message":"The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.", "code":"0"};
    this.response.send(JSONObj);
  }
  else if(result.result.rowCount == 0 || result.result.rowCount > 1) {
    log.error({'resendEmail' : bindingParams.email}, 'ResendEmail - User does not exist. New user is trying to resend verification');
    JSONObj= {"message":"Please do a new registration, or send an email to the VeeV team at services@vimsel.com.", "code":"0"};
    this.response.send(JSONObj);
  }
  else if(result.result.rowCount == 1) {
    log.info({'resendEmail' : bindingParams.email}, 'ResendEmail - User found');
    log.debug(result.result.rows[0].verificationstatus);
    if(result.result.rows[0].verificationstatus == 'VERIFIED') {
      log.error({'resendEmail' : bindingParams.email}, 'ResendEmail - Your email is already verified. Please login to start using the app.');
      JSONObj= {"message":"Your email address is already verified. Please login to start using the app.", "code":"0"};
      this.response.send(JSONObj);
    }
    updateVerificationCode(result.result, bindingParams)
  }
}

function updateVerificationCode(result, bindingParameters) {
  var bindingParams = {
    email : bindingParameters.email,
    response : bindingParameters.response,
    selectResult : result,
    newCode : undefined
  }
  if(result.rows[0].verificationstatus == 'PENDING') {
    // generated a new 12 random bytes of verificationcode
    var newCode = crypto.randomBytes(12).toString('hex').toUpperCase();
    bindingParams.newCode = newCode;
    log.info({'newUser' : bindingParams.email}, 'Register - Verification code generated for the new user ' + newCode);
    // Update the database to hold the new verification code
    //initialize an array to pass when inserting new user info in users table.
      var queryParams = [];
      queryParams[0] = newCode; //Store user's verificationcode
      queryParams[1] = bindingParams.email; //store user's email
      bindingParams.queryParams = queryParams;

      var query = "UPDATE users SET verificationcode=$1 WHERE email=$2";
      queryExecute(query, queryParams, updateQueryCallback.bind(bindingParams));
  }
}

function updateQueryCallback(result) {
  if (result.error) {
    log.error({'resendEmail' : bindingParams.email}, 'ResendEmail - Error while updating the new verification code' + result.error);
    JSONObj= {"message":"The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.", "code":"0"};
    this.response.send(JSONObj);
  }
  else if(result.result.rowCount == 0) {
    log.error({'resendEmail' : this.email}, 'ResendEmail - could not find the row to be updated.');
    JSONObj= {"message":"The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.", "code":"0"};
    this.response.send(JSONObj);
  }
  else {
    log.info({'resendEmail' : this.email}, 'ResendEmail - Updated the verification code successfully.');
    //send out the new email.
    // case 10 is used because the message needs to be displayed even when the
    // code is 1 (success).
    JSONObj={"message":"Success! Please check your inbox/spam folder for the verification link. \nVisit veev.vimsel.com if you need further assistance.",
    "code":"1", "case":"10"};
    this.response.send(JSONObj);
    //Call the sendVerificationMail function which will send the verification
    //mail to user's email address. pass array containing email and verificationcode
    var variables_insert = [];
      variables_insert[1] = this.email; //store user's email
      variables_insert[3] = this.newCode; //Store user's verificationcode
      sendVerificationMail(variables_insert);
  }

}
