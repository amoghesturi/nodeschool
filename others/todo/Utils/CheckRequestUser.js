var request = require('request');
var queryExecute = require('../Implementation/Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;

module.exports = function (request, idType, callbackFunction) {
  var bindingParams = {
    idType : idType,
    userId : undefined,
    email : undefined,
    callbackFunction : callbackFunction
  };
  log.info({user : this.userId}, 'CheckRequestUser - Checking if the user exists.');
  var queryParameters;
  var query = '';
  if(idType == 'userId') {
    bindingParams.userId = request.params.userId;
    var queryParameters = [bindingParams.userId];
    query = 'SELECT DISTINCT userId FROM users WHERE userId = $1'
  }
  else if(idType == 'imageId') {
    bindingParams.userId = request.params.imageId.split('-')[0];
    var queryParameters = [bindingParams.userId];
    query = 'SELECT DISTINCT userId FROM users WHERE userId = $1'
  }
  else if(idType == 'email') {
    bindingParams.email = request.query.email;
    var queryParameters = [bindingParams.email];
    query = 'SELECT DISTINCT id FROM users WHERE email = $1'
  }
  queryExecute(query, queryParameters,
    checkUserExists.bind(bindingParams));
}

function checkUserExists(results) {
  var userExists;
  if(results.error) {
    log.error({user : this.userId}, 'CheckRequestUser - Error querying db about the user' + results.error);
    userExists = {"error" : "database error",
      "exists" : false}
  }
  else {
    if(this.idType == 'userId' || this.idType == 'imageId') {
      if(results.result.rowCount > 0 && this.userId == results.result.rows[0].userid) {
        userExists = {"exists" : true,
          "userId" : this.userd };
      }
      else {
        log.error({user : this.userId}, 'CheckRequestUser - User does not exist');
        userExists = {"exists" : false}
      }
    }
    else if(this.idType == 'email') {
      if(results.result.rowCount > 0 && results.result.rows[0].id) {
        userExists = {"exists" : true,
          "id" : results.result.rows[0].id };
      }
      else {
        log.error({user : this.userId}, 'CheckRequestUser - User does not exist');
        userExists = {"exists" : false}
      }
    }
    else {
      log.error({user : this.userId}, 'CheckRequestUser - idType does not exist' + this.idType);
      userExists = {"exists" : false}
    }
  }
  this.callbackFunction(userExists);
}
