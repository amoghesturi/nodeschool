var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;


module.exports = function (request, response) {
  var bindingParams = {
    response : response,
    userId : request.query.userId,
    rating : request.query.rating,
    deviceType : request.query.deviceType,
    version : request.query.version
  }
  log.info({'userId' : bindingParams.userId}, 'SubmitRating - Received request to submit the ratings.');
  // Find if the user is valid
  var queryParameters = [request.query.userId];
  queryExecute('SELECT id FROM users WHERE userId=$1', queryParameters, checkUserExistsCallback.bind(bindingParams));
}

// If the user exists, inserts the rating and the primary key of the users
// table into the app_ratings table
function checkUserExistsCallback(result) {
  var bindingParams = {
    response : this.response
  }
  if(result.error) {
    log.error({'userId' : this.userId}, 'SubmitRating - Error while getting the primary key' + result.error);
    JSONObj = {"message":"Something went wrong. Try again later.", "code" : "0"};
    this.response.send(JSONObj);
  }
  else if(result.result.rowCount == 0) {
    log.error({'userId':this.userId}, 'SubmitRating - No user found matching the userId');
    JSONObj= {"message":"Something went wrong. Try again.." +
      "Please contact the VeeV team to get an invite.", "code":"0"};
    this.response.send(JSONObj);
  }
  else {
    log.info({'userId':this.userId}, 'SubmitRating - User found. Continuing to run the process and add the ratings');
    var pkey = result.result.rows[0].id;
    log.debug({'userId':this.userId}, 'SubmitRating - id = ' + pkey);
    // Run a query to insert ratings into the database
    var queryParameters = [pkey, this.rating, this.deviceType, this.version];
    queryExecute('INSERT INTO app_ratings(\"user\", app_rating, device_type, app_version) VALUES ($1, $2, $3, $4)',
      queryParameters, insertRatingCallback.bind(bindingParams));
  }
}

function insertRatingCallback(result) {
  if(result.error) {
    log.error({'userId' : this.userId}, 'SubmitRating - Error while inserting ratings into the database' + result.error);
    JSONObj = {"message":"Something went wrong. Try again later.", "code" : "0"};
    this.response.send(JSONObj);
  }
  else if(result.result.rowCount == 0) {
    log.error({'userId':this.userId}, 'SubmitRating - No user found matching the userId');
    JSONObj= {"message":"Something went wrong. Try again.." +
      "Please contact the VeeV team to get an invite.", "code":"0"};
    this.response.send(JSONObj);
  }
  else {
    log.info({'userId':this.userId}, 'SubmitRating - Successfully added user rating');
    JSONObj= {"message":"Thank you for rating us.", "code":"1"};
    this.response.send(JSONObj);
  }
}
