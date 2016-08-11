var crypto= require('crypto'); // For generating random bytes
var validator = require('validator');// for email format validation
var sendVerificationMail = require('./Database/SendVerificationMail');
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var maxUsers = require('../Configuration/MiscConfig').maxUsers;

module.exports.register = function (request, response) {
  var emailTemp = request.query.email;
  if(emailTemp) {
    // emailTemp = emailTemp.toLowerCase();
  }
  var bindingParams = {
    email : emailTemp,
    request : request,
    response : response
  }
  log.info({'newUser' : bindingParams.email}, 'Register - Received request for new user REGISTRATION');
  // // Check the list of existing users before registering
  module.exports.countUsers(bindingParams, insertVerificationCodeToDatabase.bind(bindingParams));
}

// If the # of users is less than the max allowed users, then continue to register the user.
module.exports.countUsers = function (bindingParams, next) {
  var returnValue = new Object();
  var queryParameters = [];
  var bindingParams = {
    email : bindingParams.email,
    request : bindingParams.request,
    response : bindingParams.response
  };
  queryExecute('SELECT COUNT(*) FROM users', queryParameters, function(result) {
    if(result.error) {
      log.error({'newUser':bindingParams.email}, 'Error while querying for number of existing users.' + error);
      JSONObj= {"message":"The Internet connection is slow. Please try again or send an email to the VeeV team at services@vimsel.com.", "code":"0"};
      bindingParams.response.send(JSONObj);
      returnValue.register = false;
    }
    else {
      if(result.result.rows[0].count < maxUsers) {
        log.info({'newuser':bindingParams.email}, 'Number of registered users is less than the max number of users.');
        returnValue.register = true;
        next(returnValue);
      }
      else {
          log.info({'newUser':bindingParams.email}, 'Quota Reached!! for maximum number of users = ' + maxUsers + ' is reached.');
          JSONObj= {"message":"The quota for number of users has been reached. Please try again later..", "code":"2"};
          bindingParams.response.send(JSONObj);
          returnValue.register = false;
      }
    }
  });
}

// Function generates verification code and saves in the database
function insertVerificationCodeToDatabase () {
  var bindingParams = {
    email : this.email,
    request : this.request,
    response : this.response,
    variables_insert : undefined
  };
  // generated 12 random bytes which is stored as string in the database
  // and sent with the verification email.
  var verificationcode = crypto.randomBytes(12).toString('hex').toUpperCase();
  log.info({'newUser' : this.email}, 'Register - Verification code generated for the new user ' + verificationcode);
  var JSONObj = undefined;
  var returnValue;

  //initialize an array to pass when inserting new user info in users table.
  var variables_insert = [];
  variables_insert[0] = this.request.query.userId;
  var emailTemp = this.request.query.email;
  if(emailTemp) {
  variables_insert[1] = this.request.query.email.toLowerCase(); //store user's email
  }
  else {
    variables_insert[1] = this.request.query.email //store user's email
  }
  variables_insert[2] = this.request.query.password; //store user's password
  variables_insert[3] = verificationcode; //Store user's verificationcode
  variables_insert[4] = 'PENDING'; //Set default value of verificationstatus
  variables_insert[5] = 'now()'; // Set the current time
  bindingParams.variables_insert = variables_insert;

  //use validator module to check for any invalid email provided while Registraton
  if(validator.isEmail(variables_insert[1])==true) {
    //Insert the new user into users table with following VALUES.
    log.info({'newUser' : this.email}, 'Register - User entered email is of correct format. Adding it to the database.');
    var query = "INSERT INTO users (userid,email,password,verificationcode,verificationstatus,createdtime,createdby) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_USER)";
    queryExecute(query, variables_insert, queryCallback.bind(bindingParams));
  }
  else {
    //if email address in invalid then prompt the user.
    log.info({'newUser' : this.email}, 'Register - Entered email format is wrong');
    JSONObj={"message":"Please register with valid email.", "code":"0"};
    this.response.send(JSONObj);
  }
}

// After running the add the new users to the database.
function queryCallback(result) {
  var bindingParams = {
    response : this.response
  }
  if (result.error) {
    //If there is a duplicate entry(user with same email) in the users table,
    //it will produce an error with error code = 23505
    if(result.error.code==23505) {
      log.error({'newUser' : this.email}, 'Register - User id or email unique constraint is violated.');
      log.info({'newUser' : this.email}, 'Register - Checking if the user is in Pending state');
      var queryParameters = [this.email];
      queryExecute('SELECT verificationstatus FROM users WHERE email=$1', queryParameters, checkPendingCallback.bind(bindingParams));
    }
    else {
      log.error({'newUser' : this.email}, 'Error during query execution \n' + result.error);
      JSONObj= {"message":"Please try a different email address. If the problem persists contact the VeeV team at services@vimsel.com for further assistance.", "code":"0"};
      this.response.send(JSONObj);
    }
  }
  else {
    //if no error occurs, registration was done successfully.
    log.info({'newUser' : this.email}, 'Registration Successful. Initiating verification email process');
    JSONObj={"message":"Registration Successful. Please check your email for verification.", "code":"1"};
    this.response.send(JSONObj);
    //Call the sendVerificationMail function which will send the verification
    //mail to user's email address. pass array containing email and verificationcode
    sendVerificationMail(this.variables_insert);
  }
}

function checkPendingCallback(result) {
  if(result.result.rowCount == 1) {
    if(result.result.rows[0].verificationstatus == 'PENDING') {
      // Code 10 for activating resend verification link on the client side
      log.info({'newUser' : this.email}, 'Register - user found in pending state. issue code 10');
      JSONObj= {"message":"Your email verification is pending. If previous email is lost, click on the Resend Verification option.", "code":"0", "case":"10"};
      this.response.send(JSONObj);
    }
    else {
      log.error({'newUser' : this.email}, 'Register - User found in verified state');
      JSONObj= {"message":"Email already exists in the system. Please Login!", "code":"0"};
      this.response.send(JSONObj);
    }
  }
  else {
    if(result.error) {
      log.error({'newUser' : this.email}, 'Register - error while checking if the user is in pending state ' + result.error);
      JSONObj= {"message":"Server error", "code":"0"};
      this.response.send(JSONObj);
    }
    else if(result.result.rowCount == 0) {
      log.info({'newUser' : this.email}, 'Register - user with given email id not found.');
      log.debug(result);
      JSONObj= {"message":"Server error", "code":"0"};
      this.response.send(JSONObj);
    }
    else  {
      log.error({'newUser' : this.email}, 'Register - Something went wrong');
      log.debug(result);
      JSONObj= {"message":"Server error", "code":"0"};
      this.response.send(JSONObj);
    }
  }
}
