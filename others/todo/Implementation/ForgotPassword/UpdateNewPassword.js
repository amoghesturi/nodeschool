var request = require('request');
var ejs = require('ejs');
var path = require('path');
var crypto= require('crypto');
var log = require('../../Configuration/BunyanConfig').log;
var queryExecute = require('../Database/QueryExecute');


module.exports = function(bindingParams) {
  // TODO : Come up with a way to print request.body like in - console.log(bindingParams.request.body);
  var keys = bindingParams.request.body.presetCode.split('-');
  var newPassword = bindingParams.request.body.password1;
  // Encode the new password with Sha-256 encryption.
  var sha256 = crypto.createHash('sha256').update(newPassword).digest("hex");
  var queryParameters = [keys[0], keys[1], sha256];
  var query = 'UPDATE password_change_audit SET new_password = $3,' +
  'old_password = (SELECT password from users WHERE id = users_id)' +
  'WHERE key_1 = $1 AND key_2 = $2';
  queryExecute(query, queryParameters, updatePasswordCb.bind(bindingParams));
}

// Updates password for the keys the row containing the keys.
function updatePasswordCb(result) {
  var bindingParams = {
    response : this.response
  };
  if(result.error) {
    log.error({'user':this.email}, 'ForgotPassword - Error while checking if the keys are valid' + result.error);
    var values =  {
      title : 'Invalid link',
      response: 'At this time we cannot be reset the password.' +
        'Please try again in a few minutes by requesting a new link.  If the problem persists ' +
        'contact the VeeV team at services@vimsel.com for further assistance.',
      links: 'Learn more about VeeV at'
    }
    ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else if(result.result.rowCount == 0) {
    log.error({'user':this.email}, 'ForgotPassword - Keys do not match after submitting passwords');
    var values =  {
      title : 'Invalid link',
      response: 'At this time we cannot be reset the password.' +
        'Please try again in a few minutes by requesting a new link.  If the problem persists ' +
        'contact the VeeV team at services@vimsel.com for further assistance.',
      links: 'Learn more about VeeV at'
    }
    ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
  }
  else {
    // Success.. We issue as success page.
    var values =  {
      title : 'Password Changed',
      response: 'Successfully changed the password.' +
        'contact the VeeV team at services@vimsel.com for further assistance.',
      links: 'Learn more about VeeV at'
    }
    ejs.renderFile(path.join(__dirname, '../views/generalMessage.html'), values, renderVerifyComplete.bind(bindingParams));
  }
}

// Callback function upon rendering the HTML pages.
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
