var request = require('request');
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');

module.exports = function(request, response) {
  var eventId = request.params.eventId;
  var userId = request.params.userId;
  var bindingParams = {
    response : response,
    userId : userId,
    eventId : eventId
  }
  log.info({user : userId}, 'RemoveEvent - Received request to REMOVE Event ' + eventId);
  userCheck(request, 'userId', checkUserExistsCB.bind(bindingParams));
};

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  if(userExists.exists == true) {
    var bindingParams = {
      response : this.response,
      userId : this.userId,
      eventId : this.eventId
    }
    log.info({user : this.userId}, 'RemoveEvent - Sending UPDATE query to remove event ' + this.eventId);
    queryExecute('UPDATE events SET activeflag = false where id = ' + this.eventId,
      null, queryExecuteCallback.bind(bindingParams));
  }
  else {
    log.error({user : this.userId}, 'RemoveEvent - User does not exist.');
    this.response.send({"error" : "invalid user"});
  }
}

// Remove Event callback. Sends response if everything goes well or calls the revert
// function if the client timed out early.
function queryExecuteCallback(results) {
  if(results.error) {
    log.error({user : this.userId}, 'RemoveEvent - Error while removing event from the db ' + this.eventId + '\n' + results.error);
    this.response.send({"error": "database error",
      "description":"Error during query execution"});
  }
  else if(results.result.rowCount == 0) {
    log.error({user : this.userId}, 'RemoveEvent - SEVERE ERROR!! More than one event found with eventid = ' + this.eventId);
    this.response.send({"error": "severe error",
      "description":"The image did not exist in the database"});
  }
  else {
    log.info({user : this.userId}, 'RemoveEvent - Successfully removed event from the db ' + this.eventId);
    this.response.processComplete = true;
    this.response.send({"removed":"true"});
    var ct = this.response.clientTimeOut;
    if(ct == true) {
      log.info({user : this.userId}, 'RemoveEvent - Client already timed out. Reverting event removal.');
      revertRemoveEvent(this.userId, this.eventId);
    }
  }
}

// Revert Remove Event
function revertRemoveEvent(userId, eventId) {
  var query = 'UPDATE events SET activeflag = true where id = ' + eventId
  queryExecute(query, null, revertRemoveEventCb.bind(bindParams));
}

// CB for revertFunction
function revertRemoveEventCb(result) {
  if(result.error) {
    log.error({user : userid}, 'RemoveEvent - Error reverting the removed event \n' + result.error);
  }
  else if(result.result.rowCount > 1) {
    log.error({user : userid}, 'RemoveEvent - SEVERE ERROR : Found more than one events with eventId ' + eventId);
  }
  else {
    log.info({user : userid}, 'RemoveEvent - Successfully reverted the RemoveEvent. So, ' + eventId + ' should be active');
  }
}
