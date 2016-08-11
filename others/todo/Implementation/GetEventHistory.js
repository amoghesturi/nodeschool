var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');

module.exports = function (request, response) {
  log.info({user : userId}, "GetEventHistory - Received request to receive event history for a user");
  // Get the userId and perform usercheck
  var userId = request.params.userId;
  var offsetIndex = request.query.offsetIndex;
  if(!offsetIndex) {
      offsetIndex = 0;
  }
  userCheck(request, 'userId', function (userExists) {
    if(userExists.exists != true) {
      log.error({user : userId}, 'GetEventHistory - User does not exist.');
      this.response.send({"error" : "invalid user"});
    }
    else {
      log.info({user : userId}, 'GetEventHistory - Continue to query for the recent events');
      getEventHistory(userId, offsetIndex, function(eventHistory) {
        log.info({user : userId}, 'GetEventHistory - Sending the response with event history');
        response.send(eventHistory);
      }); // End of getEventHistory CB
    } // End of else

  } ); // End of User Check CB

} // End of module exports

function getEventHistory(userId, offsetIndex, cb) {
  var query = 'SELECT ea.event_id, ' +
                     'e.eventname, ' +
                     'to_char(e.event_date, \'FMMonth DD, YYYY--HH12:MI PM\') AS event_date, ' +
                     'e.attendies, ' +
                     'a.idapperal ' +
              'FROM event_apparel ea ' +
              'JOIN apperal a ON ea.apparel_id = a.id ' +
              'JOIN events e ON e.id = ea.event_id ' +
              'WHERE ea.event_id IN ' +
                '(SELECT iddate.event_id AS event_id from ' +
                  '( SELECT DISTINCT ea.event_id, e.event_date ' +
                   'FROM event_apparel ea ' +
                   'JOIN apperal a ON a.id = ea.apparel_id ' +
                   'JOIN events e ON ea.event_id = e.id ' +
                   'WHERE a.userid = $1 ' +
                     'AND e.activeflag IS NULL ' +
                     'AND a.activeflag = $2 ' +
                   'ORDER BY e.event_date DESC LIMIT 25 ' +
                   'OFFSET $3) AS iddate ' +
                   ') ' +
                   'AND a.activeflag = \'true\'' +
              'ORDER BY e.event_date DESC; ';
  var queryParams = [userId, 'true', offsetIndex*25];
  var eventHistory = new Object();
  queryExecute(query, queryParams, function(results) {
    if(results.error) {
      log.error({user : userId}, 'GetEventHistory - Error while retreiving the id from apperal table.\n' + results.error);
      eventHistory.error = 'database error';
      cb(eventHistory);
    }
    else if(results.result.rowCount == 0) {
      log.error({user : userId}, 'GetEventHistory - Image not found');
      eventHistory.eventHistory  = [];
      cb(eventHistory);
    }
    else {
      log.info({user : userId}, 'GetEventHistory - Received the event history for the given user id');
      log.debug({user : userId}, 'GetEventHistory - Received ' + results.result.rowCount + ' events.');
      rearrangeResults(results.result.rows, function (rearrangedOnject, userId) {
        eventHistory.eventHistory = rearrangedOnject;
        cb(eventHistory);
      }); // End of rearrangeResults CB
    }
  }); // End of Query Execute
} // End of getEventHistory

// This function reads all the rows and rearranges the result to remove redundant data and
// produces a presentable output.
function rearrangeResults(rows, cb, userId) {
  log.info({user : userId}, 'GetEventHistory - Rearranging the results.');
  var events = [];
  for(var i = 0; i < rows.length; i++) {
    var eventIndex = undefined;
    var event = {};
    // Now check if the id was already used in  eventHistory
    for(var j = 0; j < events.length; j++) {
      if(events[j].id == rows[i].event_id) {
        eventIndex = j;
        event = events[j];
        break;
      }
    }
    event.id = rows[i].event_id
    event.eventName = rows[i].eventname;
    event.event_date = rows[i].event_date;
    event.attendees = rows[i].attendies;
    if(!event.images) {
      event.images = [];
    }
    event.images.push(rows[i].idapperal);
    if(eventIndex != undefined) {
      events[eventIndex] = event;
    }
    else {
      events.push(event);
    }
  }
  cb(events);
}
