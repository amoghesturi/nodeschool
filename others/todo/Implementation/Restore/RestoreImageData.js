var fs = require('fs');
var path = require('path');
var queryExecute = require('../Database/QueryExecute');
var log = require('../../Configuration/BunyanConfig').log;
var userCheck = require('../../Utils/CheckRequestUser');
var constants = require('../../Utils/Constants').constants;

module.exports = function (request, response) {
  // Get userId from Image id
  var imageId = request.params.imageId;
  var userId = request.params.imageId.split('-')[0];
  var pkey = request.query.pkey;
  var bindingParams = {
    response : response,
    userId : userId,
    imageId : imageId,
    pkey : pkey
  }
  log.info({user : userId}, 'RestoreImageData - Received request to Restore an Image');
  userCheck(request, 'imageId', checkUserExistsCB.bind(bindingParams));
}

// Continues if the user exists else exits
function checkUserExistsCB(userExists) {
    if(userExists.exists == true) {
      var bindingParams = {
        response : this.response,
        userId : this.userId,
        imageId : this.imageId,
        pkey : this.pkey
      }
      var params = [this.pkey, this.imageId, 'TRUE'];
      log.info({user : this.userId}, 'RestoreImageData - Querying for image data.');
      query = 'SELECT image FROM apperal WHERE id = $1 AND idapperal = $2 AND activeflag = $3';
      queryExecute(query, params, imageDataQueryCallback.bind(bindingParams));
    }
    else {
      log.error({user : this.userId}, 'RestoreImageData - User does not exist.');
      this.response.send({"error" : "invalid user"});
    }
}

// If the image is found, sends it out as a response and deletes the temp file
function imageDataQueryCallback(results) {
  var bindingParams = {
    userId : this.userId,
    ipath : undefined
  }
  if(results.error) {
    log.error({user : this.userId}, 'RestoreImageData - Error while querying for image data\n' + results.error);
    log.debug({user : this.userId}, 'RestoreImageData - imageId = ' + this.imageId + "\npkey = " + this.pkey);
    this.response.send({"error":"database error"});
  }
  else if(results.result.rowCount == 0) {
    log.error({user : this.userId}, 'RestoreImageData - Did not find the image with requested columns.\n');
    this.response.send({"error":"invalid image parameters"});
  }
  else {
    log.info({user : this.userId}, 'RestoreImageData - Image received. Storing it to a temp file.');
    var ipath = bindingParams.ipath = path.join("", constants.TEMP_FOLDER + this.pkey + ".jpg");
    fs.writeFileSync(ipath, results.result.rows[0].image, 'utf8');
    this.response.sendFile(ipath, null, sendFileCb.bind(bindingParams));
  }
}

// Called after the image file is sent to the clients.
function sendFileCb(err) {
  if(err) {
    log.error({user : this.userId}, 'RestoreImageData - Error sending file to the client.\n' + err);
    fs.unlink(this.ipath, unlinkFileCallback);
  }
  else {
    log.info({user : this.userId}, 'RestoreImageData - Sent image Successfully. Deleting the temperory image file');
    fs.unlink(this.ipath, unlinkFileCallback);
  }
}

// Called after deleting the temporary file
function unlinkFileCallback(error) {
  if(error) {
    log.error({user : this.userId}, 'RestoreImageData - Error deleting the temperory image file.\n' + err);
  }
  else {
    log.info({user : this.userId}, 'RestoreImageData - Successfully deleted the temperory image file.');
  }
}
