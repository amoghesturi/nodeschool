var request = require('request');
var multiparty = require('multiparty');
var fs = require('fs');
var readChunk = require('read-chunk');
var fileType = require('file-type');
var constants = require('../../Utils/Constants').constants;
var log = require('../../Configuration/BunyanConfig').log;
var queryExecute = require('../Database/QueryExecute');
var userCheck = require('../../Utils/CheckRequestUser');
var revertUploadImage = require('./RevertUploadImage');

// Main function of the Implementation
module.exports = function(request, response) {
  var userId = request.params.imageId.split('-')[0];
  log.info({user : userId}, 'UploadImage - Received request');
  var bindingParams = {
    userId : userId,
    response : response,
    request : request
  }
  userCheck(request, 'imageId', checkUserExistsCB.bind(bindingParams));
};

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  if(userExists.exists == true) {
    // Check if the content length is less than our image length
    var contentLength = this.request.headers['content-length'];
    if(!contentLength || contentLength > 1024*1024*1) {
      log.error({user : this.userId}, 'UploadImage - Content length did not match');
      this.response.send({"error": "invalid image",
        "description":"invalid image"})
    }
    else {
      // Parse the file upload
      var multipartyForm = new multiparty.Form();
      var bindingParams = {
        imageId : this.request.params.imageId,
        response : this.response,
        userId: this.userId
      }
      log.info({user : this.userId}, 'UploadImage - Parsing request');
      multipartyForm.parse(this.request, multipartyFormParseCallback.bind(bindingParams));
    }
  }
  else {
    log.error({user : this.userId}, 'UploadImage - User does not exist.');
    this.response.send({"error" : "invalid user"})
  }
}

// Called when parsing the request is completed.
function multipartyFormParseCallback(err, fields, files) {
  var bindingParams = {
    imageId : this.imageId,
    response : this.response,
    userId : this.userId
  }
  if (err){
    log.error({user : this.userId}, 'UploadImage - Error while parsing request.\n' + err);
    this.response.send({"error": "server error",
      "description":"error while parsing the request"})
  }
  else {
    var tempImagePath = files.image_file[0].path;
    // Check for the file type
    var buffer = readChunk.sync(tempImagePath, 0, 10);
    var tempFileType = fileType(buffer);
    if(tempFileType != null && tempFileType.mime == 'image/jpeg') {
      log.info({user : this.userId}, 'UploadImage - Parsing request completed.');
      log.debug({user : this.userId}, 'UploadImage - tempImagePath = ' + tempImagePath);
      uploadImageEverywhere(tempImagePath, bindingParams);
    }
    else {
      log.error({user : this.userId}, 'UploadImage - Content type did not match');
      this.response.send({"error": "invalid image",
        "description":"invalid image"});
      fs.unlink(tempImagePath, unlinkFileCallback.bind(bindingParams))
    }
  }
}

// reads the temp image file and sends it for further processing
function uploadImageEverywhere(tempImagePath, bindingParams){
  var bindingParams = {
    imageId : bindingParams.imageId,
    response : bindingParams.response,
    userId : bindingParams.userId,
    tempImagePath : tempImagePath
  };
  log.debug({user : bindingParams.userId}, 'UploadImage - Reading temperory file')
  fs.readFile(tempImagePath, readFileCallback.bind(bindingParams));
}

// Called after the file reading is completed.
// Forms the request and sends it to the image processing engine.
function readFileCallback(err, imageData) {
  if(err) {
    log.error({user : this.userId}, 'UploadImage - Error reading temperory file.\n' + err);
  }
  var bindingParams = {
    imageId : this.imageId,
    response : this.response,
    imageData : imageData,
    userId : this.userId
  };
  // Delete the temperory file
  fs.unlink(this.tempImagePath, unlinkFileCallback.bind(bindingParams))
  // Check if the image id already exists. If it exists with activeflag as
  // false, update the existing one. Else, add a new row
  var queryParameters = [bindingParams.imageId];
  log.info({user : this.userId}, 'UploadImage - Running a query to check if the image already exists in the database. ' + bindingParams.imageId);
  queryExecute('SELECT id, activeflag FROM apperal WHERE idapperal = $1',
    queryParameters, selectQueryCallback.bind(bindingParams) );
}

// Callback function for deleting temperory file. Just logs the result.
function unlinkFileCallback(err) {
  if(err) {
    log.error({user : this.userId}, 'UploadImage - Error deleting temperory file');
  }
  else {
    log.info({user : this.userId}, 'UploadImage - Deleted Temperory file');
  }
}

// Callback for function which checks if the image already exists in the database
// If the image is found active, nothing is done.
// Else if the image is found but not active, the image is updated in db and ipe
// if the image is not found, insert to db and IPE
function selectQueryCallback(results) {
  var bindingParams = {
    imageId : this.imageId,
    response : this.response,
    imageData : this.imageData,
    userId : this.userId,
    id : undefined
  };
  if(results.result.rowCount == 1) {
    var isFileActive = results.result.rows[0].activeflag;
    bindingParams.id = results.result.rows[0].id;
    if(isFileActive == false) {
      log.info({user : this.userId}, 'UploadImage - Only one result found and activeflag = false');
      log.info({user : this.userId}, 'UploadImage - Running UPDATE query to update activeflag in the database');
      var queryParameters = [bindingParams.id];
      queryExecute('UPDATE apperal SET activeflag = true WHERE id = $1',
        queryParameters, queryExecuteCallback.bind(bindingParams))
    }
    else {
      log.info({user : this.userId}, 'UploadImage - Image trying to upload was found active so not adding again to db or ISE');
      this.response.processComplete = true; // Marks that the process is complete here.
      this.response.send({"id":this.imageId, "was_offline":"true"});
      checkClientTimeOut(bindingParams);
    }
  }
  else if(results.result.rowCount > 1) {
    log.error({user : this.userId}, 'UploadImage - SEVERE ERROR!! More than one image found with the same name in the database.');
    this.response.send({"error":"cannot add image to db, ipe",
      "description":"Severe error. 2 rows with same image name exists in the database"});
  }
  else {
    // Uploading data into the database
    //Get the userId from imageId
    log.info({user : this.userId}, 'UploadImage - The image is new and being INSERTED into database.');
    log.debug({user : this.userId}, 'UploadImage - imageId = ' + bindingParams.imageId);
    var userId = bindingParams.imageId.split("-")[0];
    var queryParameters = [bindingParams.imageId, userId, this.imageData];
    queryExecute('INSERT INTO apperal(idapperal, userId, image, activeflag) VALUES ($1, $2, $3, true) returning id',
     queryParameters, queryExecuteCallback.bind(bindingParams) );
  }
}

// This callback function is called when the query execution is completed
// It looks at the result and uploads to the image processing server if database
// insertion was successful.
function queryExecuteCallback(results) {
  var bindingParams = {
    imageId : this.imageId,
    response : this.response,
    userId : this.userId,
    id : this.id
  };
  if(results.error) {
    log.error({user : this.userId}, 'UploadImage - Error executing query.\n' + results.error);
    this.response.send({"error": "database error",
      "description":"Error during query execution"});
  }
  else if(results.result.rowCount != 1) {
    log.error({user : this.userId},'UploadImage - SEVERE ERROR!! Insert/Update query changed more than one row.');
    this.response.send({"error": "severe error",
      "description":"Error during query execution"});
  }
  else {
    // Sending request to image Processing engine
    log.info({user : this.userId}, 'UploadImage - Successfully updated/inserted into database.');
    log.info({user : this.userId}, 'UploadImage - Sending request to ISE');
    if(!bindingParams.id) {
      bindingParams.id = results.result.rows[0].id;
    }
    var reqParameters = {method: 'PUT',
      uri: constants.URL_UPLOAD + this.imageId,
      multipart:[{
        'content-disposition': 'form-data; name="image_file"; filename="undefined"',
        'content-type': 'image/jpeg',
        body: this.imageData
      }]
    };
    log.debug({user : this.userId}, "" + reqParameters);
    reqParameters.multipart[0].body = this.imageData;
    request(reqParameters, sendUploadRequest.bind(bindingParams))
      .auth(constants.USERNAME, constants.PASSWORD, false);
  }
}


function sendUploadRequest(err, res, body) {
  var bindingParams = {
    imageId : this.imageId,
    response : this.response,
    userId : this.userId,
    id : this.id
  };
  if (err) {
    log.error({user : this.userId}, 'UploadImage - Error while uploading to ISE.\n' + err);
    queryExecute('UPDATE apperal SET activeflag = false WHERE id = ' + this.id,
     null, deleteApparelCallback.bind(bindingParams) );
    this.response.send({"error": "Server Error",
      "description":"Error while uploading to the ISE"});
  }
  else {
    var parsedBody = JSON.parse(body);
    if(parsedBody.id != undefined && parsedBody.is_update != undefined) {
      log.info({user : this.userId}, 'UploadImage - Successfully added to ISE. ' + body);
      log.info({user : this.userId}, 'UploadImage - Sending request for adding to offline cache. .');
      addImageOffline(bindingParams, body);
      // TODO : Do not add to the image offline cache
    }
    else {
      log.info({user : this.userId}, 'UploadImage - Could not upload to ISE. It responded with ' + body);
      log.info({user : this.userId}, 'UploadImage - Reverting the apparel which was added to the database.');
      log.debug({user : this.userId}, 'UploadImage - Deleting apparel with id = ' + this.id);
      queryExecute('UPDATE apperal SET activeflag = false WHERE id = ' + this.id,
       null, deleteApparelCallback.bind(bindingParams) );
       this.response.send({"error":err,
         "description":"Error while uploading to the ISE"});
		 // If the image was successfully inserted into the databsae but not into IPE
	   revertUploadImage(bindingParams);
    }
  }
}

function deleteApparelCallback(results) {
  if(results.error) {
    log.error({user : this.userId}, 'UploadImage - Error executing query while deleting.\n' + results.error);
  }
  else if(results.result.rowCount == 0) {
    log.error({user : this.userId},'RemoveImage - SEVERE ERROR!! The image row trying to remove did not exist in db.\n');
  }
  else {
    log.info({user : this.userId}, 'Successfully deleted from the database.');
  }
}

//
function addImageOffline (bindingParams, uploadResponse) {
  var bindingParams = {
    imageId : bindingParams.imageId,
    response : bindingParams.response,
    uploadResponse : uploadResponse,
    id : bindingParams.id
  };
  var url = constants.URL_UPLOAD + bindingParams.imageId + '/offline';
  log.info({user : this.userId}, "UploadImage - Adding image to offline cache");
  log.info({user : this.userId}, "UploadImage - " + url);
  request.post(url, addImageOfflineCallback.bind(bindingParams))
  .auth(constants.USERNAME, constants.PASSWORD, false);
}

// Cb for adding into offline cache
// Checks if the response link was open and if not things are reverted back.
function addImageOfflineCallback(error, res, body) {
  var bindingParams = {
    imageId : this.imageId,
    response : this.response,
    uploadResponse : this.uploadResponse,
    id : this.id
  };
  this.response.processComplete = true;
  if (error) {
    log.error({user : this.userId}, "UploadImage - Error while adding to offline cache. Sending uploadResponse.");
    this.response.send(this.uploadResponse);
  }
  else {
    // passing the result directly from image processing engine
    log.info({user : this.userId}, "UploadImage - Successfully added to offline cache. " + body);
    this.response.send(body);
  }
  var ct = this.response.clientTimeOut;
  checkClientTimeOut(bindingParams);
}

// Common function for checking if the client has timed out.
// Should be used only when the client times out not otherwise.
function checkClientTimeOut(bindingParams) {
  var ct = bindingParams.response.clientTimeOut;
  if(ct == true) {
    log.info({user : bindingParams.userId}, 'UploadImage - Reverting changes. Image will be removed from the table apperal.');
    var bindingParams = {
      userId : bindingParams.userId,
      imageId : bindingParams.imageId,
      id : bindingParams.id
    };
    revertUploadImage(bindingParams);  // Reverts process because the client has timed out before process is complete.
  }
}
