var mathjs = require('mathjs');
var path = require('path');
var ejs = require('ejs');
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var verifyTimeLimit = require('../Configuration/MiscConfig').verifyTimeLimit;

module.exports = function (request, response) {
  var token = request.query.token;
  var email = request.query.email.toLowerCase();
  var bindingParams = {
    token : token,
    email : email,
    response : response
  };
  log.info({'email' : email}, 'EmailValidation - Received request.');
  log.info({'email' : email}, 'EmailValidation - Getting information about the received email and token');

  //SELECT the user with the verificationcode retried earlier from request.
  var query = "SELECT verificationstatus, lastupdated FROM users WHERE verificationcode=$1 and email=$2";
  var queryParams =[token, email];
  queryExecute(query, queryParams, queryExecuteCallback.bind(bindingParams));
};

// Callback function for the select query
function queryExecuteCallback(result) {
  var bindingParams = {
    email : this.email,
    response : this.response
  };
  if (result.error) {
    log.error({'email' : this.email}, 'EmailValidation - Error executing the query.\n' + this.token);
    // Error occured while running the query
    var values = {
      title : 'Server Error!!',
      response: 'The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.',
      links : 'If the problem persists, contact us at'
    };
    ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else if(result.result.rowCount == 0) {
    log.info({'email' : this.email}, 'EmailValidation - User with this email and token was not found.');
    log.debug({'email' : this.email}, result.result);
    var values = {
      title : 'Error!!',
      response: 'The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.',
      links: 'If the problem persists, contact us at'
    };
    ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  //check if the verificationstatus is PENDING. If not then verificationtime
  //is already done!
  else if (result.result.rows[0].verificationstatus == 'PENDING') {
    log.info({'email' : this.email}, 'EmailValidation - The email was found in PENDING state.');
    var verificationtime = new Date();
    var lastupdated = new Date(result.result.rows[0].lastupdated);
    //calculate the time difference between the current time and the time user registered
    //If verification is done within 24 hours, then proceed to VERIFY email.
    //time difference given in milliseconds. divide by 3600000 to get in hours.
    var timeDiff = (mathjs.abs(lastupdated-verificationtime)/3600000)
      if(timeDiff < verifyTimeLimit) {
        log.debug({'email' : this.email}, 'EmailValidation - Verification process initialted after ' + timeDiff + ' hours');
        log.info({'email' : this.email}, 'EmailValidation - Changing verification status.');
        query = "UPDATE users SET verificationstatus=$1 WHERE verificationcode=$2 AND email=$3";
        var queryParams =["VERIFIED", this.token, this.email];
        //store the result of callback funtion(query execution) in new vatiable
        queryExecute(query, queryParams, updateQueryCallback.bind(bindingParams));
      }
      else {
        //If more that 24 hours has passed betwwen sending verification link
        //and user clicking the link then, link is expired.
        log.error({'email' : this.email}, 'EmailValidation - Verification link expired');
        var values = {
          title : 'Time ran out!!',
          response: 'Please do a new registration, or send an email to the VeeV team at services@vimsel.com.',
          links : 'Note: Contact VeeV team to resend verification email at'
        };
        ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
      }
    }
    // If the email was already verified
    else if (result.result.rows[0].verificationstatus == 'VERIFIED') {
      //If verificationstatus for user is not PENDING then, user already completed
      //verification by clicking the link in the past.
      log.info({'email' : this.email}, 'EmailValidation - The email was found in VERIFIED state.');
      var values = {
        title : 'You are already verified',
        response: 'Please click on images from the app instead of clicking the link. \n\nYour email address has already been verified. You can sign-in and start using the App.',
        links: 'Need more info? Visit us at'
      };
      ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
    }
    // No error, Not Pending or not verified. Any other condition
    else {
      log.info({'email' : this.email}, 'EmailValidation - SEVER ERROR!! Email was found neither in Pending nor Verified state.');
      log.debug({'email' : this.email}, result.result);
      var values = {
        title : 'Server Error!!',
        response: 'The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.',
        links : 'Report to VeeV team at'
      };
      ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
    }
}

// Function called after the execution of update query
function updateQueryCallback(result_verified) {
  var bindingParams = {
    email : this.email,
    response : this.response
  };
  if (result_verified.error) {
    log.info({'email' : this.email}, 'EmailValidation - Error while updating database with Verified state.');
    var values = {
      title : 'Server Error!!',
      response: 'The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.',
      links : 'If the problem persists, contact us at'
    };
    ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else if(result_verified.result.rowCount == 0) {
    log.error({'email' : this.email}, 'EmailValidation - Databse did not contain any rows with emailId and token');
    log.debug({'email' : this.email}, 'EmailValidation - token : ' + this.token);
    var values = {
      title : 'Server Error',
      response: 'The Internet connection is slow, please try again or send an email to the VeeV team at services@vimsel.com.',
      links : 'If the problem persists, contact us at'
    };
    ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else if(result_verified.result.rowCount == 1) {
    //If there is no error then, send message that email Address is Verified.
    log.info({'email' : this.email}, 'EmailValidation - Email address verified');
    var values = {
      title : 'Awesome..!!',
      response: 'Your email address is now verified. You may now start using VeeV.',
      links : 'Need more info? Visit us at'
    };
    ejs.renderFile(path.join(__dirname, '/views/verifiedemail.html'), values, renderVerifyComplete.bind(bindingParams));
  }
}

function renderVerifyComplete (err, result) {
  if(!err) {
    log.info({'user':'admin'}, 'Rendering completed. Response sent successfully.');
    this.response.write(result);
    this.response.end();
  }
  else {
    log.error({'user':'admin'}, 'error rendering HTML page ' + err);
    this.response.write(err);
    this.response.end();
  }
}
