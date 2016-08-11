var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var login = require('./Login')
var async = require('async');

module.exports = function (request, response) {
  var userId = request.params.userId;
  log.info({user : userId}, 'UnlinkSocialMedia - Received request to unlink other social media.');
  var type = request.query.type;

  if(type == 'facebook') {
    unlinkFacbook(request, response);
  }
  else {
    log.error({user : userId}, 'UnlinkSocialMedia - wrong social media type - ' + type);
    var JSONObj = {error : true, "message" : "invalid type"};
    response.send(JSONObj);
  }
}

// Function to unlink facebook account from the user profile
function unlinkFacbook(request, response) {
  var userId = request.params.userId;
  log.info({user : userId}, 'UnlinkSocialMedia - Received request to unlink facebook');
  // Query to remove link in users table
  var queryParams = [userId];
  var query = 'UPDATE users SET fb_link = NULL ' +
              'FROM (SELECT fb_link FROM users WHERE userid = $1) Y ' +
              'WHERE userid = $1 RETURNING Y.fb_link';
  queryExecute(query, queryParams, function (result) {
    if(result.error) {
      log.error({user : userId}, 'UnlinkSocialMedia - Error while removing fb_link in users \n' + result.error);
      var JSONObj = {error : true, "message" : "Database error"};
    }
    else if(result.result.rowCount == 0) {
      log.error({user : userId}, 'UnlinkSocialMedia - Did not find the user with the userId');
      var JSONObj = {error : true, "message" : "Invalid user"};
    }
    else if(result.result.rowCount > 1) {
      log.error({user : userId}, 'UnlinkSocialMedia - SEVERE ERROR : Updated more than one row when the userId was - ' + userId);
      var JSONObj = {error : true, "message" : "Database error"};
    }
    else {
      log.info({user : userId}, 'UnlinkSocialMedia - Succesfully removed fb_link for the user in users table');
      log.info({user : userId}, 'UnlinkSocialMedia - Removing the row from facebook_accounts table');
      var fbLink = result.result.rows[0].fb_link;
      // Delete the row in the facebook_accounts table
      var queryParams = [fbLink];
      var query = 'DELETE FROM facebook_accounts WHERE id = $1';
      var JSONObj = {error : false, "message" : "Unlink successful"};
      queryExecute(query, queryParams, function (result) {
        if(result.error) {
          log.error({user : userId}, 'UnlinkSocialMedia - Error while removing fb_link in users \n' + result.error);
        }
        else if(result.result.rowCount == 0) {
          log.error({user : userId}, 'UnlinkSocialMedia - Did not find the user with the userId');
        }
        else if(result.result.rowCount > 1) {
          log.error({user : userId}, 'UnlinkSocialMedia - SEVERE ERROR : Deleted more than one row when the pkey of facebook-accounts was - ' + fbLink);
        }
        else {
          log.info({user : userId}, 'UnlinkSocialMedia - Successfully deleted the row from facebook_accounts table');
        }
      }) // End of delete query
    } // End of else
    response.send(JSONObj);
  }) // End of update queryExecute
} // End of unlinkFacbook function
