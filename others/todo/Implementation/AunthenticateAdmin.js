var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var constants = require('../Utils/Constants').constants;
var fs = require('fs');
var ejs = require('ejs');
var promise = require('promise');

module.exports = function(request, response) {
  log.info("Request Received");
  var userName = request.body.userName;
  var password = request.body.password;
  // verify if the username and password is right
  var p1 =  verifyUser(userName, password)
  .then(getResultsFork)
  .then(printResults)
  .then(function(result) {
    log.info({user : 'admin'}, "Writing response successfully");
    response.write(result);
    response.end();
  })
  .catch(function(result) {
    printErrorResults(result, response)
  })
}

/**
*
* Checks the user name and password
*@param {userName} - userName Received
*@param {password} - password Received
*
*@return - Promise fulfilled with true or false or rejected with error
*/
function verifyUser(userName, password) {
  var userVerified = false;
  log.info({user : 'Admin'}, 'Verifying username and password');
  if( (userName == 'b1Biw@La' && password == 'miAnw@L1') || userName == 'admin' && password == 'admin') {
    return Promise.resolve(true);
  }
  else {
    return Promise.reject(new Error('Please check your credentials'));
  }
}


/*
* Function to get all the data to be displayed on the dashboard
*
*/
function getResultsFork(bindingParameters) {
  log.info({user : "admin"}, 'Entering getResultsFork');
  return Promise.all([
    // 1. Query to get all the registered users
    getCountRegisteredUsers(),
     // 2. Query To get users in pending state
    getCountPendingUsers(),
    // 3. Number of Apparel
    getCountOfApparel()
  ]);
}


/**
*
*Function to get the number of all the registered users
*
*@returns - Promise containing the result or error
*/
function getCountRegisteredUsers() {
  log.info({user : "admin"}, 'Entering getCountRegisteredUsers');
  var queryParameters = {};
  return new Promise(function(fulfil, reject) {
    queryExecute('SELECT count(*) from users', queryParameters, function(result, index) {
      if(result.error) {
        log.error({'user':'admin'}, 'Error while running query for ' + index + result.error);
        reject(new Error('Server Error'));
      }
      else {
        fulfil(result.result.rows[0].count);
      }
    }, 'users');
  });
}

/**
*
*Function to get the number of pending users
*
*@returns - Promise containing the result or error
*/
function getCountPendingUsers() {
  log.info({user : "admin"}, 'Entering getCountPendingUsers');
  var queryParameters = {};
  return new Promise(function(fulfil, reject) {
    queryExecute('SELECT count(*) from users where verificationstatus=\'PENDING\'', queryParameters, function(result, index) {
      if(result.error) {
        log.error({'user':'admin'}, 'Error while running query for ' + index + result.error);
        reject(new Error('Server Error'));
      }
      else {
        fulfil(result.result.rows[0].count);
      }
    }, 'pending_users');
  });
}

/**
*
*Function to get the count of apparel
*
*@returns - Promise containing the result or error
*/
function getCountOfApparel() {
  log.info({user : "admin"}, 'Entering getCountOfApparel');
  var queryParameters = {};
  return new Promise(function(fulfil, reject) {
    queryExecute('SELECT count(*) from apperal', queryParameters, function(result, index) {
      if(result.error) {
        log.error({'user':'admin'}, 'Error while running query for ' + index + result.error);
        reject(new Error('Server Error'));
      }
      else {
        fulfil(result.result.rows[0].count);
      }
    }, 'apparel_count');
  });
}

/**
*
* Renders the html file and resturns the promise.
* @param {results} - contains the results that need to be populated in the response html
* @returns - Promise containing the rendered html or rejects promise
*/
function printResults(results) {
  return new Promise (function (fulfil, reject) {
    // Getting Row Counts
    log.info({'user':'admin'}, 'Entering printResults');
    var values = {
      count_total_users : results[0],
      count_pending_users :  results[1],
      count_apparel : results[2],
    };
    // HTML file is rendered
    ejs.renderFile(__dirname + '/views/dashboard.html', values, function(err, result) {
      if(!err) {
        log.info({'user':'admin'}, 'Rendering completed. Response sent successfully.');
        fulfil(result);
      }
      else {
        log.error({'user':'admin'}, 'error rendering HTML page ' + err);
        reject(new Error('Server Error'));
      }
    });
  })
}

/**
*
* Renders the html file and resturns the promise (for error messages).
* @param {results} - contains the results that need to be populated in the response html
* @returns - Promise containing the rendered html or rejects promise
*/
function printErrorResults(error, response) {
  if(error.type != "Error") {
    error = new Error('Server Error')
  }
  console.log(error);
    var values = {
      error_title : "Error",
      error_message : error.message,
      login_page : constants.IP + "/adminPortal"
    };
    // Error page is rendered
    ejs.renderFile(__dirname + '/views/adminPortalError.html', values, function(err, result) {
      if(err) {
        log.error("Error while rendering adminPortalError page\n" + err);
        result = "Server Error. Please try again. Contact VeeV team if problem persists.";
      }
      response.write(result);
      response.end();
    });
}
