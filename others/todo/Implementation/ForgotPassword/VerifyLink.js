var mathjs = require('mathjs');
var ejs = require('ejs');
var path = require('path');
var log = require('../../Configuration/BunyanConfig').log;
var queryExecute = require('../Database/QueryExecute');
var passwordResetTimeLimit = require('../../Configuration/MiscConfig').passwordResetTimeLimit;

module.exports = function(bindingParams) {
  log.info({user : bindingParams.email}, 'ForgotPassword - Received request upon clicking link in the email');
  var keys = bindingParams.request.query.presetCode.split('-');
  // Check if both the keys exist in the keys exist.
  var queryParameters = [keys[0], keys[1]];
  var query = 'SELECT * from password_change_audit WHERE key_1 = $1 AND key_2 = $2';
  bindingParams.keys = keys[0] + "-" + keys[1];
  queryExecute(query, queryParameters, checkKeysCb.bind(bindingParams));
}

function checkKeysCb(result) {
  var bindingParams = {
    response : this.response
  };
  // TODO : console.log(result.result.rows[0]);
  if(result.error) {
    log.error({'user':this.email}, 'ForgotPassword - Error while checking if the keys are valid' + result.error);
    var values =  {
      title : 'Invalid link',
      response: 'At this time we cannot be reset the password. ' +
        'Please try again in a few minutes by requesting a new link.  If the problem persists ' +
        'contact the VeeV team at services@vimsel.com for further assistance.',
      links: 'Learn more about VeeV at'
    }
    ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else if(result.result.rowCount == 0) {
    log.error({'user':this.email}, 'ForgotPassword - No rows with matching keys');
    var values = {
      title : 'Invalid link',
      response: 'Could not find the user associated. ' +
        'Contact the VeeV team at services@vimsel.com for further assistance.',
      links: 'Learn more about VeeV at'
    }
    ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else if(result.result.rows[0].link_status) {
    log.error({'user':this.email}, 'ForgotPassword - Link was already Invalidated');
    var values =  {
      title : 'Invalid link',
      response: 'The link is for one time use only. ' +
        'If you need to reset your password, cick on forgot password in the app. ' +
        'Contact the VeeV team at services@vimsel.com for further assistance.',
      links: 'Learn more about VeeV at'
    }
    ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else {
    log.info({'user':this.email}, 'ForgotPassword - Found the keys in the database');
    // Compare the date and time when the row was created
    // continue, if less than 3 hours
    var createdtime =  new Date(result.result.rows[0].createdtime);
    var timeDiff = (mathjs.abs(createdtime-new Date())/3600000)
      if(timeDiff > passwordResetTimeLimit) {
        log.error({'email' : this.email}, 'ForgotPassword - Link Expired. Password link clicked after ' + timeDiff + ' hours');
        var values = {
          title : 'Link Expired',
          response: 'You exceeded the time limit to use the link.' +
            'Please try again in a few minutes by requesting a new link. ' +
            'Contact the VeeV team at services@vimsel.com for further assistance.',
          links: 'Learn more about VeeV at'
        }
        ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
      }
      else {
        log.debug({'email' : this.email}, 'ForgotPassword - Password link clicked after ' + timeDiff + ' hours');
        var values = {
          presetCode : this.keys
        };
        ejs.renderFile(path.join(__dirname, '../views/changePassword.html'), values, renderVerifyComplete.bind(bindingParams));
      }
  }
  var queryParams = ['INAVALID', result.result.rows[0].id]
  var updateQuery = 'UPDATE password_change_audit SET link_status = $1 WHERE id = $2';
  queryExecute(updateQuery, queryParams, insertQueryCb);
}

function renderVerifyComplete (err, result) {
  if(err) {
    log.error({'user':this.email}, 'ForgotPassword - error rendering HTML page ' + err);
    this.response.write('Render incomplete.. Contact VeeV team at services@vimsel.com');
    this.response.end();
  }
  else {
    log.info({'user':this.email}, 'ForgotPassword - Rendering completed. Response sent successfully.');
    this.response.write(result);
    this.response.end();
  }
}

function insertQueryCb(result) {
  if(result.error) {
    log.error({'user':this.email}, 'ForgotPassword - Error invalidating reset password link ' + result.error);
  }
  else if(result.result.rowCount == 0) {
    log.error({'user':this.email}, 'ForgotPassword - Row count 0 when invalidating reset password link');
  }
  else {
    log.info({'user':this.email}, 'ForgotPassword - Successfully invalidated reset password link');
  }
}
