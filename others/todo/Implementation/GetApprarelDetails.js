var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');


module.exports = function(request, response) {
  var imageId = request.params.imageId;
  var userId = request.params.imageId.split('-')[0];
  var offsetIndex = request.query.offsetIndex;
  if(!offsetIndex) {
      offsetIndex = 0;
  }
  log.info({user : userId}, "GetApprarelDetails - Received request to receive details of the apparel");

  // binding parameters
  var bindingParams = {
    request : request,
    response : response,
    imageId : imageId,
    offsetIndex : offsetIndex
  };
  // Check if the user exists
  userCheck(request, 'imageId', checkUserExistsCB.bind(bindingParams));
}

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  var bindingParams = {
    request : this.request,
    response : this.response,
    userId : this.userId,
    imageId : this.imageId,
    imageDetails : new Object(),
    offsetIndex : this.offsetIndex,
    counter : 2
  };
  if(userExists.exists == true) {
    log.info({user : this.userId}, 'GetApprarelDetails - Continue to get details of the apparel.');
    // Gets all the meta data from the apperal table.
    getInfo(bindingParams);
    // Get all the events and details of the events attached to the image
    getEvents(bindingParams);
  }
  else {
    log.error({user : this.userId}, 'GetApprarelDetails - User does not exist.');
    this.response.send({"error" : "invalid user"});
  }
}

// Get the information about the apparel in the apparel table.
function getInfo(bindingParams) {
  // TODO: if there is offset value, no need to query for apparel info
  log.info({user : this.userId}, 'GetApprarelDetails - Getting info of the apparel.');
  var queryParameters = [bindingParams.imageId, 'true']; // The details should be fetched only for active images.
  var query = 'SELECT idapperal, userid, color, brand, source, appeareltype, to_char(date_acquired, \'FMMonth DD, YYYY\') AS date_acquired, ' +
    'giftedby, donated_to, ' +
    'to_char(donated_date, \'FMMonth DD, YYYY\') AS donated_date FROM apperal ' +
    'WHERE idapperal = $1 AND activeflag = $2';
  queryExecute(query, queryParameters, getInfoCb.bind(bindingParams));
}

// Get the information about the apparel in the apparel table.
function getEvents(bindingParams) {
  log.info({user : bindingParams.userId}, 'GetApprarelDetails - Getting events of the apparel.');
  // 25 is the number of events we are fetching with every request.
  var queryParameters = [bindingParams.imageId, 'true', bindingParams.offsetIndex*25];
  var query = 'SELECT id, eventname, to_char(event_date, \'FMMonth DD, YYYY--HH12:MI PM\') AS event_date, attendies, location ' +
              'FROM events WHERE activeflag IS NULL AND id IN ' +
              '( SELECT DISTINCT event_id FROM event_apparel ' +
              'WHERE apparel_id IN ' +
              '( SELECT id FROM apperal ' +
              'WHERE idapperal = $1 ' +
              'AND activeflag = $2 ) ) ORDER BY events.event_date DESC, events.id DESC LIMIT 25 ' +
              'OFFSET $3;;'
  queryExecute(query, queryParameters, function (results) {
    if(results.error) {
      log.error({user : bindingParams.userId}, 'GetApprarelDetails - Error while querying for events. \n' + results.error );
      bindingParams.response.send({error : 'database Error'});
    }
    else {  // If there was no error executing query
      log.info({user : bindingParams.userId}, 'GetApprarelDetails - Found ' + results.result.rowCount + ' events for the apparel id provided.' );
      var events = new Object();
      events = results.result.rows;
      bindingParams.imageDetails.events = events;
      // Get all the images associated with the events that are fetched.
      log.info({user : bindingParams.userId}, 'GetApprarelDetails - Getting details from event_apparel')
      var eventIds = '';
      for(var i = 0; i < results.result.rowCount; i++) {
        eventIds = eventIds + results.result.rows[i].id + ', ';
      }
      try {
        eventIds = eventIds.slice(0, -2);
      }
      catch(err) {
        eventIds = '';
      }

      if(eventIds) {
        eventIds = '(' + eventIds + ')';
        var query = 'SELECT EA.id AS id, ' +
           'EA.event_id AS event_id, ' +
           'A.idapperal AS idapperal ' +
           'FROM event_apparel EA ' +
           'JOIN apperal A ON EA.apparel_id = A.id ' +
           'WHERE EA.event_id IN ' + eventIds +
           'AND A.activeflag = \'true\'';
        queryExecute(query, null, getEventApparelDetailsCb.bind(bindingParams))
      }
      else {
        bindingParams.counter--;
        if(bindingParams.counter == 0) {
          finalQueryCb(bindingParams);
        }
      }
    } // End of else
  });
}

// Callback for get info query request
function getInfoCb(results) {
  if(results.error) {
    log.error({user : this.userId}, 'GetApprarelDetails - Error while querying for info. \n' + results.error );
    this.response.send({error : 'database Error'});
  }
  else if(results.result.rowCount == 0) {
    log.error({user : this.userId}, 'GetApprarelDetails - Image not found.');
    log.debug({user : this.userId}, 'GetApprarelDetails - ImageId : ' + this.imageId);
    this.response.send({error : "invalid image", details : "image either deleted or does not exist"});
  }
  else {
    // Image was found, put it into the imageDetails, and then check if the other
    // queries are ready
    var info = new Object();
    info = results.result.rows[0];
    this.imageDetails.info = info;

    // decrease the counter and call final callback if the counter is zero
    this.counter--;
    if(this.counter == 0) {
      var bindingParams = {
        response : this.response,
        userId : this.userId,
        imageId : this.imageId,
        imageDetails : this.imageDetails,
        counter : this.counter
      };
      finalQueryCb(bindingParams);
    }
  } // End of else
} // End of function

// // Callback for get Events query request
// function getEventsCb(results) {
//
// } // End of function


// Callback function after getting event_apparel details
function getEventApparelDetailsCb(results) {
  if(results.error) {
    log.error({user : this.userId}, 'GetApprarelDetails - Error while querying for events_apparel details. \n' + results.error );
    this.response.send({error : 'database Error'});
  }
  else {
    log.info({user : this.userId}, 'GetApprarelDetails - Obtained details successfully.')
    var eventApparel = new Object();
    eventApparel = results.result.rows;
    this.imageDetails.eventApparel = eventApparel;
    // decrease the counter and call final callback if the counter is zero
    this.counter--;
    if(this.counter == 0) {
      var bindingParams = {
        response : this.response,
        userId : this.userId,
        imageId : this.imageId,
        imageDetails : this.imageDetails,
        counter : this.counter
      };
      finalQueryCb(bindingParams);
    }
  } // End of else
} // End of callback function

function finalQueryCb(bindingParams) {
  log.info({user : this.userId}, 'GetApprarelDetails - Sending Response');
  bindingParams.response.send(bindingParams.imageDetails);
}
