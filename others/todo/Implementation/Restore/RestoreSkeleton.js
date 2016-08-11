var queryExecute = require('../Database/QueryExecute');
var log = require('../../Configuration/BunyanConfig').log;
var userCheck = require('../../Utils/CheckRequestUser');
var fs = require('fs');
var path = require('path');

module.exports = function(request, response) {
  var userId = request.params.userId;
  log.info({user : userId}, "RestoreSekeleton - Received request to retreive skeleton");

  // binding parameters
  var bindingParams = {
    request : request,
    response : response,
    userId : userId
  };
  // Check if the user exists
  userCheck(request, 'userId', checkUserExistsCB.bind(bindingParams));
}

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  var bindingParams = {
    request : this.request,
    response : this.response,
    userId : this.userId
  };
  if(userExists.exists == true) {
    log.info({user : this.userId}, 'RestoreSekeleton - User found..');
    fetchSkeleton(bindingParams);
  }
  else {
    log.error({user : this.userId}, 'RestoreSekeleton - User does not exist.');
    this.response.send({"error" : "invalid user"});
  }
}

// Function which fetches the skeleton of the restore data
function fetchSkeleton(bindingParams) {
  log.info({user : bindingParams.userId}, 'RestoreSekeleton - Sending query to fetch image data');
  // Fetch the number of images and their names
  var queryParameters = [bindingParams.userId, 't'];
  var query = 'select id, idapperal, color, brand, source, appeareltype, to_char(date_acquired, \'FMMonth DD, YYYY\') AS date_acquired, giftedby, ' +
  'donated_to, ' +
  'to_char(donated_date, \'FMMonth DD, YYYY\') AS donated_date ' +
  ' from apperal where userid = $1 and activeflag = $2'
  queryExecute(query, queryParameters, imagesQueryCb.bind(bindingParams));
}

//
function imagesQueryCb(result) {
  var bindingParams = {
    response : this.response,
    userId : this.userId,
    imageSkeleton : new Object(),
    eventStatus : 0,
  };
  bindingParams.imageSkeleton.images = [];
  if(result.error) {
    log.error({user : this.userId}, 'RestoreSekeleton - Error trying to query the image skeleton ' + result.error);
    bindingParams.imageSkeleton.error = "database error";
    this.response.send(bindingParams.imageSkeleton);
  }
  else if(result.result.rowCount == 0) {
    log.error({user : this.userId}, 'RestoreSekeleton - Query returned 0 images');
    bindingParams.imageSkeleton.error = "no images";
    this.response.send(bindingParams.imageSkeleton);
  }
  else {
    log.info({user : this.userId}, 'RestoreSkeleton - Received data for ' + result.result.rowCount + ' images');
    bindingParams.imageSkeleton.rowCount = result.result.rowCount;
    // For every image found, query for the details of their events
    for(i = 0; i < bindingParams.imageSkeleton.rowCount; i++) {
      //For each image, find the number of events and their ids
      var image = new Object();
      image.imageData = result.result.rows[i];
      bindingParams.imageSkeleton.images[i] = image;
      log.debug(result.result.rows[i].idapperal);
      // Because the structure of events and since image details are pulled every time they open the details
      // page, no need to send the event related values in skeleton
    }
    finalEventCallback(bindingParams);
  }
}

function finalEventCallback(bindingParams) {
  log.info({user : this.userId}, 'RestoreSkeleton - Sending Response');
  bindingParams.response.send(bindingParams.imageSkeleton);
}
