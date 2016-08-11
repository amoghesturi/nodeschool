var sendEmail = require('./SendEmail');
var crypto= require('crypto'); // For generating random bytes
var userCheck = require('../../Utils/CheckRequestUser');
var log = require('../../Configuration/BunyanConfig').log;
var queryExecute = require('../Database/QueryExecute');

// Part of Forgot password where we initiate the process of sending emails
module.exports = function(bindingParams) {
  log.info({user : bindingParams.email}, 'ForgotPassword - Request received to send password reset link')
  userCheck(bindingParams.request, 'email', checkUserExistsCB.bind(bindingParams));
}


// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  var msg = "Please check your email for a link about password reset from us.";
  var emailParams = {
    userExists : undefined,
    email : this.email
  };
  var bindingParams = {
    email : this.email,
    response : this.response,
    message : msg,
    emailParams : emailParams
  };
  if(userExists.exists == true && userExists.id) {
    log.debug({user : this.email}, 'ForgotPassword - user found : true')
    emailParams.userExists = true;
    // generate two random strings
    var key1 = emailParams.key1 = crypto.randomBytes(5).toString('hex');
    var key2 = emailParams.key2 = crypto.randomBytes(15).toString('hex');
    // Add these strings in the Database
    var queryParameters = [userExists.id, key1, key2];
    query = 'INSERT INTO password_change_audit(users_id, key_1, key_2) VALUES ($1, $2, $3)'
    queryExecute(query, queryParameters, addKeysToDatabaseCb.bind(bindingParams))
  }
  else {
    log.error({user : this.email}, 'ForgotPassword - user found : false')
    emailParams.userExists = false;
    // Sends the email saying email could not be identified
    sendEmail(emailParams);
    this.response.send({"message" : msg});
  }
}

// If the keys were stored in the database, sends an email to the entered email address.
function addKeysToDatabaseCb(result) {
  if(result.error) {
    log.error({'user':this.email}, 'ForgotPassword - Error while storing password reset keys to the database' + result.error);
    JSONObj= {"message":"At this time we cannot be reset the password. " +
              "Please try again in a few minutes.  If the problem persists " +
              "contact the VeeV team at services@vimsel.com for further assistance." , "code":"0"};
    this.response.send(JSONObj);
  }
  else if(result.result.rowCount == 0) {
    log.error({'user':this.email}, 'ForgotPassword - Query executed successfully but rowcount is 0');
    JSONObj= {"message":"At this time we cannot be reset the password. " +
              "Please try again in a few minutes.  If the problem persists " +
              "contact the VeeV team at services@vimsel.com for further assistance." , "code":"0"};
    this.response.send(JSONObj);
  }
  else {
    log.info({'user':this.email}, 'ForgotPassword - Succesfuly inserted password reset keys to the database');
    // Send email
    var emailParams = this.emailParams;
    sendEmail(emailParams);
    JSONObj= {"message" : this.message};
    this.response.send(JSONObj);
  }
}
