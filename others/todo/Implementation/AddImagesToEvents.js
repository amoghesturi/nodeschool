var request = require('request');
var fs = require('fs');
var async = require('async');
var constants = require('../Utils/Constants').constants;
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');

module.exports = function (request, response) {
  log.info({user : this.userId}, 'AddImagesToEvents - Received request to add images to an event');
  var bindingParams = {
    listOfImages : request.body.images,
    eventId : request.body.eventId,
    userId : request.params.userId,
    response : response,
    eventMatches : undefined,
    userExists : undefined
  };
  userCheck(request, 'userId', checkUserExistsCB.bind(bindingParams));
  checkEventMatches(bindingParams);
}

// checks if the event id provided belongs to the user id provided.
function checkEventMatches(bindingParams) {
  log.info({user : this.userId}, 'AddImagesToEvents - Checking if the event matches to the user');
  //TODO : Check if the event belongs to this user.
  bindingParams.eventMatches = 'true';
  checkAndContinue(bindingParams);
}

// callback after querying if the user exists
function checkUserExistsCB(userExists) {
  var bindingParams = {
    listOfImages : this.listOfImages,
    eventId : this.eventId,
    userId : this.userId,
    response : this.response,
    eventMatches : this.eventMatches,
    userExists : this.userExists,
    count : this.listOfImages.length
  };
  log.info({user : this.userId}, 'AddImagesToEvents - Obtained results from userCheck');
  bindingParams.userExists = userExists.exists;
  checkAndContinue(bindingParams);
}

// This function check if the parallel execution of querying if the user exists
// and if the event belongs to that user is compled or not.
function checkAndContinue(bindingParams) {
  if(bindingParams.userExists && bindingParams.eventMatches) {
    log.info({user : bindingParams.userId}, 'AddImagesToEvents - Continuing..');
    getApparelId(bindingParams);
  }
}

// Once user check and eventcheck queries are executed, continue to add the apparel
function getApparelId(bindingParams) {
  if(!bindingParams.userExists) {
    log.error({user : bindingParams.userId}, 'AddImagesToEvents - user id is invalid');
    bindingParams.response.send({"error" : "invalid user"});
  }
  else if (!bindingParams.eventMatches) {
    log.error({user : bindingParams.userId}, 'AddImagesToEvents - Event does not belong to the user');
    bindingParams.response.send({"error" : "invalid event"});
  }
  else{ // The user exists
    // Parse the received data
    var images = bindingParams.listOfImages;
    log.info({user : bindingParams.userId}, 'AddImagesToEvents - Getting apparel ids given image names');
    for(var i = 0; i < images.length; i++) {
      // Get image id from apperal table
      var queryParameters = [images[i].name];
      var query = 'SELECT id FROM apperal WHERE idapperal = $1';
      queryExecute(query, queryParameters, getApparelIdCb.bind(bindingParams), i);
      // We know the event id
      // insert statement with eventId and apparelId and imageType
    }
  }
}

// Callback function after getting the id from the apperal table.
function getApparelIdCb(results, index) {
  var bindingParams = {
    listOfImages : this.listOfImages,
    eventId : this.eventId,
    userId : this.userId,
    response : this.response,
    count : this.count
  };
  if(results.error) {
    log.error({user : this.userId}, 'AddImagesToEvents - Error while retreiving the id from apperal table.\n' + results.error);
    this.listOfImages[index].error = 'database error';
    this.listOfImages[index].id = 0;
  }
  else if(results.result.rowCount == 0) {
    log.error({user : this.userId}, 'AddImagesToEvents - Image not found');
    this.listOfImages[index].error = 'invalid image';
    this.listOfImages[index].id = 0;
  }
  else if(results.result.rowCount > 1) {
    log.error({user : this.userId}, 'AddImagesToEvents - Image name is not unique');
    this.listOfImages[index].error = 'server error';
    this.listOfImages[index].id = 0;
  }
  else {
    log.info({user : this.userId}, 'AddImagesToEvents - Received the id from apperal table.');
    log.info({user : this.userId}, 'AddImagesToEvents - Adding image to the event');
    this.listOfImages[index].id = results.result.rows[0].id;
  }
  this.count --;
  if(this.count == 0) {
    // bindingParams.count is the one passed to the callback functions. Hence, that needs to be updated
    // not this.count
    bindingParams.count = this.listOfImages.length;
    for(var i = 0; i < this.listOfImages.length; i++) {
      if(!this.listOfImages[i].error) {
        // Continue to add the image to the event_apparel table.
        if(!this.listOfImages[i].type) {
          this.listOfImages[i].type = 'ITEM';
        }
        var queryParameters = [this.listOfImages[i].id, this.eventId, this.listOfImages[i].type];
        var query = 'INSERT INTO event_apparel (apparel_id, event_id, image_type) VALUES ($1, $2, $3) RETURNING id';
        queryExecute(query, queryParameters, eventApparelInsertCb.bind(bindingParams), i);
      }
    }
  }
};

//
function eventApparelInsertCb(results, index) {
  if(results.error) {
    log.error({user : this.userId}, 'AddImagesToEvents - Error while inserting into event_apparel table.\n' + results.error);
    this.listOfImages[index].error = 'database error';
    this.listOfImages[index].id = 0;
  }
  else if(results.result.rowCount > 1) {
    log.error({user : this.userId}, 'AddImagesToEvents - More than one row inserted.');
    this.listOfImages[index].error = 'server error';
    this.listOfImages[index].id = 0;
  }
  else {
    log.info({user : this.userId}, 'AddImagesToEvents - Successfully inserted into the event_apparel table');
    // Continue to add the image to the event_apparel table.
    this.listOfImages[index].id = results.result.rows[0].id;
  }
  this.count --;
  if(this.count == 0) {
    // Setting that the entire process is complete
    this.response.send(this.listOfImages);
    this.response.processComplete = true;
    // Revert back the image - delete it if the client timed out
    // before completing the entire process
    if(this.response.clientTimeOut == true) {
      log.info({user : this.userId}, 'AddImagesToEvents - Client timed out before entire process is complete.');
      revertInserImageToEvents(this.listOfImages, this.userId);
    }
  }
}

// Function to revert back the insert transaction.
function revertInserImageToEvents(listOfImages, userId) {
  var bindingParams = {
    userId : userId
  }
  log.info({user : userId}, 'AddImagesToEvents - Reverting back changes');
  var tempParam = '';
  for(var i = 0; i < listOfImages.length; i++) {
    if(listOfImages[i].id && listOfImages[i].id != 0) {
      tempParam = tempParam + listOfImages[i].id + ', ';
    }
  }
  try {
    tempParam = tempParam.slice(0, -2);
  }
  catch(err) {
    tempParam = '';
  }
  if(tempParam) {
    tempParam = '(' + tempParam + ')';
    var query = 'DELETE FROM event_apparel WHERE id IN ' + tempParam;
    queryExecute(query, null, eventApparelDeleteCb.bind(bindingParams));
  }
}

// Callback function for delete image from event query
function eventApparelDeleteCb(results) {
  if(results.error) {
    log.error({userId : this.userId}, 'AddImagesToEvents - Error while deleteing/reverting image added to events\n' + results.error);
  }
  else {
    log.info({userId : this.userId}, 'AddImagesToEvents - The number of images deleted from the event : ' + results.result.rowCount);
  }
}
