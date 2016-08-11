var request = require('request');
var constants = require('../Utils/Constants').constants;
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');

module.exports = function(request, response) {
  var imageId = request.params.imageId;
  var userId = request.params.imageId.split('-')[0];
  var type = request.query.type;
  var bindingParams = {
    response : response,
    userId : userId,
    imageId : imageId,
    type : type
  }
  log.info({user : userId}, 'RemoveImage - Received request to REMOVE IMAGE.');
  userCheck(request, 'imageId', checkUserExistsCB.bind(bindingParams));
};

// Continues if the user exists else exits
// Removes image from teh database if the user exists
function checkUserExistsCB(userExists) {
    if(userExists.exists == true) {
      var bindingParams = {
        response : this.response,
        userId : this.userId,
        imageId : this.imageId,
        type : this.type
      };
      var params = ['false', this.imageId];
      if(this.type == 'force') {
        log.info({user :this.userId}, 'RemoveImage - Received request to FORCE DELETE image.')
      }
      log.info({user : this.userId}, 'RemoveImage - Updating the db about the image being removed.');
      queryExecute('UPDATE apperal SET activeflag = $1 WHERE idapperal = $2',
        params, queryCallback.bind(bindingParams));
    }
    else {
      log.error({user : this.userId}, 'RemoveImage - User does not exist.');
      this.response.send({"error" : "invalid user"});
    }
}

// called after the query is executed. sends response
function queryCallback(results) {
  if(results.error) {
    log.error({user : this.userId}, 'RemoveImage - Error updating the image removal in db.\n' + results.error);
    if(this.type == 'force') {
      removeImageFromIPE(this.imageId, this.response, this.type);
    }
    else {
      this.response.send({"error": "database error",
        "description":"Error during query execution"});
    }
  }
  else if(results.result.rowCount == 0) {
    log.error({user : this.userId}, 'RemoveImage - The image row trying to remove/update did not exist in db.\n');
    if(this.type == 'force') {
      removeImageFromIPE(this.imageId, this.response, this.type);
    }
    else {
      this.response.send({"error": "request error",
        "description":"The image did not exist in the database"});
    }
  }
  else {
    log.info({user : this.userId}, 'RemoveImage - successfully removed/updated the image from the db..\n');
    removeImageFromIPE(this.imageId, this.response, this.type);
  }
}

// Sends request to IPE to remove the image
function removeImageFromIPE (imageId, response, type) {
  var userId = imageId.split('-')[0];
  var bindingParams = {
    response : response,
    userId : userId,
    imageId : imageId,
    type : type
  }
  log.info({user : userId}, 'RemoveImage - Sending HTTP request to delete the image from IPE');
  log.debug({user : userId}, 'RemoveImage - ' + constants.URL_DELETE + imageId);
  request.del(constants.URL_DELETE + imageId, removeImageFromIPECallback.bind(bindingParams))
  .auth(constants.USERNAME, constants.PASSWORD, false);
}

// callback processing the response of the IPE
function removeImageFromIPECallback(error, res, body) {
  var bindingParams = {
    response : this.response,
    userId : this.userId,
    imageId : this.imageId,
    type : this.type
  };
  var body = JSON.parse(body);
  if (error) {
    log.error({user : this.userId}, 'RemoveImage - Error while removing the image from IPE\n' + error);
    if(this.type == 'force') {
      // Since this is a force delete, continue and delete associated events
      deleteAssociatedEvents(bindingParams);
    }
    else {
      this.response.send({"error": "IPE error",
              "description":"Error while removing from image processing engine"});
      revertBackRemovedImage(this.imageId);
    }
  }
  else if(body.existed == false) {
    log.error({user : this.userId}, 'RemoveImage - Image trying to remove did not exist in IPE' + 'body.existed =' + body.existed);
    if(this.type == 'force') {
      // Since this is a force delete, continue and delete associated events
      deleteAssociatedEvents(bindingParams);
    }
    else {
      this.response.send({"error": "request error",
        "description":"Image did not exist in image processing engine"});
      // There would not be an image to revert back. Added here becuase it causes no harm
      // and next time, if we have changes in revertBackRemovedImage, it can be changed in only one place
      revertBackRemovedImage(this.imageId);
    }
  }
  else {
    log.info({user : this.userId}, 'RemoveImage - Successfully removed image from the IPE.');
    // Removing the events associated with the image
    // Find all the events associated with the image
    deleteAssociatedEvents(bindingParams);
  }
}

// Function frames a query and executes it to delete associated events of the image
function deleteAssociatedEvents(bindingParams) {
  log.info({user : this.user}, 'RemoveImage - Removing events associated with the image.')
  var queryParameters = [bindingParams.imageId];
  var query = 'SELECT id FROM events WHERE idapperal = $1'
  queryExecute(query, queryParameters, getEventsCb.bind(bindingParams))
}

// Called when something goes wrong when removing from IPE
// and the image removal needs to revert back
function revertBackRemovedImage(imageId) {
  var bindingParams = {
    userId : this.userId,
    imageId : this.imageId
  };
  var params = ['true', imageId];
  log.info({user : this.userId}, 'RemoveImage - Reverting back changes in the database if the image was not deleted in IPE');
  queryExecute('UPDATE apperal SET activeflag = $1 WHERE idapperal = $2',
    params, revertBackRemovedImageCb.bind(bindingParams));
}

// Callback after reverting baack removed image
function revertBackRemovedImageCb(result) {
  if(result.error) {
    log.error({user : this.userId}, 'RemoveImage - Error while reverting back' + result.error);
    log.debug({user : this.userId}, 'RemoveImage - Image Id :' + this.imageId);
  }
  else {
    log.info({user : this.userId}, 'RemoveImage - Successfully reverted back changes.');
  }
}

// Remove events if any exist
function getEventsCb(result) {
  var bindingParams = {
    response : this.response,
    userId : this.userId,
    rowCount : result.result.rowCount
  };
  if(result.error) {
    log.error({user : this.userId}, 'RemoveImage - Error while getting the list of events associated with the image ' + result.error);
    log.debug({user : this.userId}, 'RemoveImage - Image Id : ' + this.imageId);
    this.response.send({"removed":"true", "removeEvents":"false"});
  }
  else if(result.result.rowCount == 0) {
    log.info({user : this.userId}, 'RemoveImage - No events were associated with the image.');
    log.debug({user : this.userId}, 'RemoveImage - Image Id : ' + this.imageId);
    this.response.send({"removed" : "true"});
  }
  else {
    var queryIds = "";
    for(var i = 0; i < result.result.rowCount; i++) {
      queryIds += '\''+result.result.rows[i].id+'\',';
    }
    queryIds = queryIds.substring(0, queryIds.length-1);
    log.debug({user : this.user}, 'Removing events ' + queryIds);
    var queryParameters = ['f'];
    var query = 'UPDATE events SET activeflag = $1 WHERE id IN (' + queryIds + ')';
    queryExecute(query, queryParameters, removeEventsCallback.bind(bindingParams));
  }
}

// Callback from removing events query
function removeEventsCallback(result) {
  if(result.error) {
    log.error({user : this.userId}, 'RemoveImage - Error while removing events assocociated with the image ' + result.error);
    this.response.send({"removed":"true", "removeEvents":"false"});
  }
  else {
    log.info({user : this.userId}, 'RemoveImage - Deleted events assocociated successfully');
    this.response.send({"removed":"true", "removeEvents":this.rowCount});
  }
}
