var request = require('request');
var constants = require('../Utils/Constants').constants;
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');

var responseGlobal = undefined;
var imageId = undefined;

// main function of the imeplementation
module.exports = function (request, response) {
  var userId = request.params.imageId.split('-')[0];
  log.info({user : userId}, 'UpdateImage - Received request.');
  var bindingParams = {
    request : request,
    response : response,
    request : request,
    category : request.query.category,
    userId : userId,
    imageId : request.params.imageId
  }
  userCheck(request, 'imageId', checkUserExistsCB.bind(bindingParams));
};

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  if(userExists.exists == true) { // The user exists
    var bindingParams = {
      request : this.request,
      response : this.response,
      category : this.request.query.category,
      userId : this.userId,
      imageId : this.imageId,
      oldInfo : undefined
    };
    // Parse the received data
    var category = this.request.query.category

    if(category == 'info') {
      log.info({user : this.userId}, 'UpdateImage - Received UPDATE INFORMATION request.');
      // GETTING OLD INFO FROM THE DATABASE......
      var query = 'SELECT brand, source, color, appeareltype, to_char(date_acquired, \'FMMonth DD, YYYY\') AS date_acquired, ' +
                  'giftedby, donated_to ,' +
                  'to_char(donated_date, \'FMMonth DD, YYYY\') AS donated_date ' +
                  'FROM apperal WHERE idapperal = $1';
      var queryParameters = [this.request.params.imageId];
      queryExecute(query, queryParameters, getOldInfoCb.bind(bindingParams));
    }
    else if (category == 'event') {  // Block to add an event
      log.info({user : this.userId}, 'UpdateImage - Received ADD EVENT request.');
      var results;
      var imageId = this.request.params.imageId;
      var eventDescription = this.request.query.description;
      var event_date = this.request.query.date + '--' + this.request.query.time;
      var attendees = this.request.query.attendees;
      var queryParameters = [eventDescription, event_date, attendees];
      log.debug({user : this.userId}, 'UpdateImage - Sending INSERT INTO events query request.' + queryParameters);
      var split_event_date = this.request.query.date.split(' ');
      var query = 'INSERT INTO events (eventname, attendies) VALUES ($1, $3) returning id'
      if(split_event_date[0].length > 3) {
        query = 'INSERT INTO events (eventname, event_date, attendies) VALUES ($1, to_timestamp($2, \'FMMonth DD, YYYY--HH12:MI PM\'), $3) returning id'
      }
      else {
        var query = 'INSERT INTO events (eventname, event_date, attendies) VALUES ($1, to_timestamp($2, \'Mon DD, YYYY--HH12:MI PM\'), $3) returning id'
      }
      queryExecute(query, queryParameters, queryExecuteCallback.bind(bindingParams));
    }
    else {
      log.error({user : this.userId}, 'UpdateImage - Received update request with wrong category -' + category);
      this.response.send({"error": "wrong category",
        "description":"you sent " + category});
    }
  }
  else {
    log.error({user : this.userId}, 'UpdateImage - User does not exist.');
    this.response.send({"error" : "invalid user"})
  }
}

// Saves the old info so that we can revert back to it if updating fail.
function getOldInfoCb(result) {
  var bindingParams = {
    response : this.response,
    category : this.category,
    userId : this.userId,
    imageId : this.imageId,
    oldInfo : this.oldInfo
  };
  if(result.error) {
    log.error({user : this.userId}, 'UpdateImage - Could not retrieve old info. Sending error');
    response.send({"error": "database error", "description" : "could not find the info associated with this image."});
  }
  else {
    var results = bindingParams.oldInfo = result.result.rows[0];
    var imageId = this.request.params.imageId
    var queryParameters = [this.request.query.brand,
      this.request.query.source,
      this.request.query.color,
      this.request.query.appeareltype,
      this.request.query.date_acquired,
      this.request.query.giftedby,
      this.request.params.donatedTo,
      this.request.params.imageId];
      if(this.request.query.donatedDate) {
        queryParameters[8] = this.request.query.donatedDate;
      }
      else {
        queryParameters[8] = 'January 01, 0001';
      }
    var split_date_acquired = this.request.query.date_acquired.split(' ');
    log.debug({user : this.userId}, 'UpdateImage - Sending UPDATE query request.' + queryParameters);
    // update to new info
    if(split_date_acquired[0].length > 3) {
      log.debug(getInfoUpdateQuery('full'));
      queryExecute(getInfoUpdateQuery('full', this.request.query.donatedDate), queryParameters, queryExecuteCallback.bind(bindingParams) );
    }
    else {
      log.debug(getInfoUpdateQuery('half'));
      queryExecute(getInfoUpdateQuery('half', this.request.query.donatedDate), queryParameters, queryExecuteCallback.bind(bindingParams) );
    }
  }
}

//
function queryExecuteCallback(results) {
  var userId = this.userId;
  if(results.error) {
    log.error({user : userId}, 'UpdateImage - Error during query execution ' + results.error);
    this.response.send({"error": "database error",
      "description":"Error during query execution"});
  }
  else if(results.result.rowCount != 1) {
    log.error({user : userId}, 'UpdateImage - SEVERE ERROR!! Rowcount more than one while updating or inserting. Row Count = ' + results.result.rowCount);
    this.response.send({"error": "severe error",
      "description":"Error during query execution"});
  }
  else {
    if(this.category == 'info') {
      var res = {"updated":"true"};
      log.info({user : userId}, 'UpdateImage - Successfully updated info in the db.');
      this.response.processComplete = true;
      this.response.send(res);
      var ct = this.response.clientTimeOut;
      if(ct == true) {
        revertBackInfo(this.userId, this.imageId, this.oldInfo);
      };
    }
    else {
      var res = {"inserted":"true", "id":results.result.rows[0].id};
      log.info({user : userId}, 'UpdateImage - Successfully added event to the db.' + res);
      this.response.processComplete = true;
      this.response.send(res);
      if(this.response.clientTimeOut == true) {
        revertAddEvent(this.userid, results.result.rows[0].id);
      }
    }
  }
}

// This function gives the query string.
// monthType = full represents months written as January and
// monthType = half represents first 3 characters like Jan
function getInfoUpdateQuery(monthType, donated_date) {
  var queryPart = 'date_acquired = $5';
  var donatedDatePart = ', donated_date = $9 ';
  if (monthType == 'full') {
    queryPart = 'date_acquired = to_timestamp($5, \'FMMonth DD YYYY HH24:MI:SS:US\'), ';
  }
  else if(monthType == 'half') {
    queryPart = 'date_acquired = to_timestamp($5, \'Mon DD YYYY HH24:MI:SS:US\'), ';
  }
  // If donated_date was sent, check the style and assign proper sql function
  if(donated_date) {
    var split_donated_date = donated_date.split(' ');
    if(split_donated_date[0].length > 3) {
      donatedDatePart = ', donated_date = to_timestamp($9, \'FMMonth DD YYYY HH24:MI:SS:US\') ';
    }
    else {
      donatedDatePart = ', donated_date = to_timestamp($9, \'Mon DD YYYY HH24:MI:SS:US\') ';
    }
  }
  var query = 'UPDATE apperal SET brand =  $1,' +
              'source = $2,' +
              'color = $3,' +
              'appeareltype = $4,' +
              queryPart +
              'giftedby = $6, ' +
              'donated_to = $7 ' +
              donatedDatePart +
              'WHERE idapperal = $8';
  return query;
}

// This function updates teh info again with its older values
function revertBackInfo(userId, imageId, oldInfo) {
  var bindingParams = {
    userId : userId
  }
  log.info({user : userId}, 'updateImage - Info - Client timed out before completing the process. Hence, reverting');
  var queryParameters = [oldInfo.brand,
    oldInfo.source,
    oldInfo.color,
    oldInfo.appeareltype,
    oldInfo.date_acquired,
    oldInfo.giftedby,
    oldInfo.donated_to,
    imageId];
    if(oldInfo.donatedDate) {
      queryParameters[8] = oldInfo.donatedDate;
    }
    else {
      queryParameters[8] = 'January 01, 0001';
    }
    var split_date_acquired = oldInfo.date_acquired.split(' ');
    if(split_date_acquired[0].length > 3) {
      queryExecute(getInfoUpdateQuery('full', oldInfo.donated_date), queryParameters, revertInfoCb.bind(bindingParams) );
    }
    else {
      queryExecute(getInfoUpdateQuery('half', oldInfo.donated_date), queryParameters, revertInfoCb.bind(bindingParams) );
    }
}

// Function that reverts the added event when client times out before completing processing
function revertAddEvent(userId, eventId) {
  var bindingParams = {
    userId : userId
  }
  log.info({user : userId}, 'Updateimage - Event - Client timed out before completing the process. Hence, deleting event');
  var query = 'UPDATE events SET activeflag = false WHERE id = $1';
  var queryParameters = [eventId];
  queryExecute(query, queryParameters, revertInfoCb.bind(bindingParams));
}

// Revert Info, Events Callback
function revertInfoCb(result) {
  if(result.error) {
    log.error({user : this.userId}, 'UpdateImage - Error Reverting data. \n' + result.error);
  }
  else {
    log.info({user : this.userId}, 'UpdateImage - Successfully reverted data. \n');
  }
}
