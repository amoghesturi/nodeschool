var request = require('request');
var multiparty = require('multiparty');
var fs = require('fs');
var readChunk = require('read-chunk');
var fileType = require('file-type');
var constants = require('../Utils/Constants').constants;
var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var userCheck = require('../Utils/CheckRequestUser');

// main function of the imeplementation
module.exports = function (request, response) {
  var userId = request.params.userId;
  var bindingParams = {
    userId : userId,
    response : response,
    request : request
  }
  log.info({user : userId}, 'RecognizeImage - Received request to RECOGNIZE image.');
  userCheck(request, 'userId', checkUserExistsCB.bind(bindingParams));
};

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
  if(userExists.exists == true) {
    var bindingParams = {
      userId : this.userId,
      response : this.response
    }
    // Check if the content length is less than our image length
    var contentLength = this.request.headers['content-length'];
    if(!contentLength || contentLength > 1024*1024*1) {
      log.error({user : this.userId}, 'UploadImage - Content length did not match');
      response.send({"error": "invalid image",
        "description":"invalid image"})
    }
    else {
      // Parse the file upload
      var multipartyForm = new multiparty.Form();
      log.info({user : this.userId}, 'RecognizeImage - Parsing request for image data.');
      multipartyForm.parse(this.request, multipartyFormParseCallback.bind(bindingParams));
    }
  }
  else {
    log.error({user : this.userId}, 'RecognizeImage - User does not exist.');
    this.response.send({"error" : "invalid user"})
  }
}

// Parsing the multiparty form to get the image bytes
function multipartyFormParseCallback(err, fields, files) {
  var bindingParams = {
    userId : this.userId,
    response : this.response,
    tempImagePath : files.image_file[0].path
  }
  if (err) {
    log.error({user : this.userId}, 'RecognizeImage - Error parsing imageData from request.\n' + err);
    this.response.send({"error":"server error",
      "description":"Error reading image from request"});
  }
  else {
    // Check for the file type
    var buffer = readChunk.sync(bindingParams.tempImagePath, 0, 10);
    var tempFileType = fileType(buffer);
    if(tempFileType != null && tempFileType.mime == 'image/jpeg') {
      // Send the temperory image path for further processing
      sendImageToImageProcessingEngine(bindingParams);
    }
    else {
      log.error({user : this.userId}, 'UploadImage - Content type did not match');
      this.response.send({"error": "invalid image",
        "description":"invalid image"});
      fs.unlink(bindingParams.tempImagePath, unlinkFileCallback.bind(bindingParams))
    }
  }
}

// Reads the image and callsback
function sendImageToImageProcessingEngine(globalData) {
  var bindingParams = {
    userId : globalData.userId,
    response : globalData.response,
    tempImagePath : globalData.tempImagePath
  }
  log.info({user : globalData.userId}, 'RecognizeImage - Reading temperory file ' + globalData.tempImagePath);
  fs.readFile(bindingParams.tempImagePath, readFileCallback.bind(bindingParams));
}

// Called when image reading is completed. Sends the image data to image
// processing engine for json result. Also updates the database
function readFileCallback(err, data) {
  var bindingParams = {
    userId : this.userId,
    response : this.response,
    tempImagePath : this.tempImagePath,
    imageData :data
  }
  if(err) {
    log.info({user : this.userId}, 'RecognizeImage - Error reading temperory file ' + this.tempImagePath);
    this.response.send({"error":"server error",
      "description":"Error reading the received file"});
  }
  else {
    var reqParameters = {method: 'POST',
      uri: constants.URL_RECOGNIZE,
      multipart:[{
        'content-disposition': 'form-data; name="image_file"; filename="undefined"',
        'content-type': 'image/jpeg',
        body: data
      }]
    };
    log.info({user : this.userId}, 'RecognizeImage - Sending data to IPE for recognition.');
    request(reqParameters, sendSearchRequest.bind(bindingParams))
    .auth(constants.USERNAME,
      constants.PASSWORD,
      false);
  }
}

// callback function which sends the actual search request.
function sendSearchRequest(error, res, body) {
  var bindingParams = {
    userId : this.userId,
    response : this.response,
    tempImagePath : this.tempImagePath,
    imageData : this.imageData,
    body : body
  };
  if (error) {
    log.error({user : this.userId}, 'RecognizeImage - Error while sending request to IPE');
    this.response.send({"error":"IPE error",
      "description":"Error returned from the image processing engine"});
  }
  else {
    addTodatabase(bindingParams);
  }
}

// Inserts the result from Image Processing engine to the recognition history table.
function addTodatabase(bindingParams) {
  var bindingData = {
    response : bindingParams.response,
    tempImagePath : bindingParams.tempImagePath,
    body : bindingParams.body,
    userId : bindingParams.userId
  };
  var responseBody = JSON.parse(bindingParams.body);
  var result = null;
  if(responseBody.found == true) {
    log.info(responseBody.id);
    result = responseBody.id;
  }
  else {
    result = null;
  }
  var queryParameters = [bindingParams.userId, bindingParams.imageData, result];
  log.info({user : bindingParams.userId}, 'RecognizeImage - Adding details about image recognition to the database.\n');
  queryExecute('INSERT INTO recognitionhistory(userid, image, result) VALUES ($1, $2, $3) RETURNING id',
    queryParameters, queryExecuteCallback.bind(bindingData));
}

// After inserting into recogntion history table,
// send response from Image Processing Engine back to the clients.
function queryExecuteCallback(results) {
  var bindingParams = {
    userId : this.userId
  };
  if(results.error) {
    log.error({user : this.userId}, 'RecognizeImage - Error adding recognition history to db.\n' + results.error);
    this.response.send({"error": "database error",
      "description":"Error during query execution"});
  }
  else if(results.result.rowCount != 1) {
    log.error({user : this.userId}, 'RecognizeImage - SEVERE ERROR!! Added more than one row into recognition history');
    this.response.send({"error": "severe error",
      "description":"Error during query execution"});
  }
  else {
    log.info({user : this.userId}, 'RecognizeImage - Succesfully added to Recognition history.');
    log.info({user : this.userId}, 'RecognizeImage - Sending response ' + this.body);
    var id = JSON.parse(this.body).id;
    // Marking that the process is completed here and if the client
    // times out after this, changes will not be reverted back
    this.response.processComplete = true;
    if(id && id.split('-')[0] == this.userId) {
        this.response.end(this.body);
    }
    else {
      log.debug({user : this.userId}, 'RecognizeImage - Image does not exist in ISE ' + this.body);
      this.response.send({"found" : false});
    }
    // Check if the client has timed out And if the response was sent.
    var ct = this.response.clientTimeOut;
    if(ct == true) {
      log.info({user : this.userId}, 'RecognizeImage - Reverting changes. Removing recent data from Recognition Table.');
      removeFromRecognitionHistory(results.result.rows[0].id, bindingParams);
    }
  }
  // delete temperory file
  fs.unlink(this.tempImagePath, unlinkFileCallback);
}


// Function that removes the rows in the recognition history table.
function removeFromRecognitionHistory(pkey, bindingParams) {
  log.debug(pkey);
  log.debug(bindingParams);
  var query = 'DELETE FROM recognitionhistory WHERE id = $1';
  var queryParams = [pkey];
  queryExecute(query, queryParams, removeFromRecognitionHistoryCb.bind(bindingParams));
}

// Callback function for removing from recognition history. Logs if the delete
// query was successfully executed or not.
function removeFromRecognitionHistoryCb(result) {
  if(result.error) {
    log.error({user : this.userId}, 'RecognizeImage - Reverting changes stopped with error.\n' + result.error);
  }
  else if(result.result.rowCount > 1) {
    log.error({user : this.userId}, 'RecognizeImage - Reverting changes, more than one row deleted.\n' + result.error);
  }
  else {
    log.info({user : this.userId}, 'RecognizeImage - Reverting changes Succesful.');
  }
}

// Callback after deleting the temperory image. Just logs data. Does nothing else
function unlinkFileCallback(err) {
  if (err) {
    log.error({user : this.userId}, 'RecognizeImage - Error deleting the temperory recognition file\n' + err);
   }
   else {
     log.info({user : this.userId}, 'RecognizeImage - Deleted temperory recognition file\n');
   }
}
