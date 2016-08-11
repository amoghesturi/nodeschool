var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var constants = require('../Utils/Constants').constants;
var fs = require('fs');
var ejs = require('ejs');
var promise = require('promise');

module.exports = function(request, response) {
  log.info("Loading admin page");
  return new Promise(function(fulfil, reject) {
    var error, loginHtml;
    ejs.renderFile(__dirname + '/views/adminLandingPage.html', null, function(err, result) {
      error = err;
      loginHtml = result;
    });
    if(loginHtml) {
      fulfil(loginHtml);
    }
    else {
      reject(new Error(error));
    }
  })
  .then(function(result) {
    log.info("Login page successfully rendered. Sending response");
    response.write(result);
    response.end();
  })
  .catch(function(err) {
    log.error("Error while loading admin page\n" + err.message);
    var values = {
      error_title : "Server Error",
      error_message :  "There was an error loading the page. Please try again. Contact VeeV team if problem persists.",
      login_page : constants.IP + "/adminPortal"
    };
    // Error page is rendered
    ejs.renderFile(__dirname + '/views/adminPortalError.html', values, function(error, result) {
      if(error) {
        log.error("Error while rendering adminPortalError page\n" + err.message);
        result = "There was an error loading the page. Please try again. Contact VeeV team if problem persists.";
      }
      response.write(result);
      response.end();
    });
  })
}
