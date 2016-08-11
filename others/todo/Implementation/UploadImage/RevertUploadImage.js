var request = require('request');
var constants = require('../../Utils/Constants').constants;
var log = require('../../Configuration/BunyanConfig').log;
var queryExecute = require('../Database/QueryExecute');

module.exports = function(bindingParams) {
  log.info({user : bindingParams.userId}, 'RevertUploadImage - Received request to revert image upload');
  log.debug(bindingParams.id);
  log.debug(bindingParams.imageId);
  var query = 'UPDATE apperal SET activeflag = $1 WHERE id = $2';
  var queryParams = ['false', bindingParams.id];
  queryExecute(query, queryParams, removeImageIPE.bind(bindingParams));
}

// CB function after updating the database about the removal
// If the database is updated, continue and remove it in the IPE
function removeImageIPE(result) {
  var bindingParams = {
    userId : this.userId,
    imageId : this.imageId
  }
  if(result.error) {
    log.error({user : this.userId}, 'RevertUploadImage - Updating database failed due to ' + result.error);
  }
  else if(result.result.rowCount == 1){
    log.info({user : this.userId}, 'RevertUploadImage - Sending request to IPE to revert changes.');
    request.del(constants.URL_DELETE + this.imageId, removeImageIPECb.bind(bindingParams))
      .auth(constants.USERNAME, constants.PASSWORD, false);
  }
}

// CB function to read response from IPE
function removeImageIPECb(error, response, body) {
  var body = JSON.parse(body);
  if (error) {
    log.error({user : this.userId}, 'RemoveImage - Error while removing the image from IPE\n' + error);
  }
  else if(body.existed == false) {
    log.error({user : this.userId}, 'RemoveImage - Image trying to remove did not exist in IPE' + 'body.existed =' + body.existed);
  }
  else {
    log.info({user : this.userId}, 'RemoveImage - Successfully removed image from the IPE.');
  }
}
