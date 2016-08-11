var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var login = require('./Login')
var async = require('async');

module.exports = function (request, response) {
  var userId = request.params.userId;
  var type = request.query.type;

  log.info({user : userId}, 'LinkSocialMedia - Received request to link a social media account');
  if(type == 'facebook') {
    // Get details from the facebook account.
    var facebookEmail = request.query.email.toLowerCase();
    var facebookUserId = request.query.facebookUserId;
    var userAccessToken = request.query.userAccessToken;

    var name = request.query.name;
    var gender = request.query.gender;
    var profile_picture;
    var fbLink;

    async.series([
      // Function 1 : Parse the image from the request.
      function(emptyCallback) {
        profile_picture = login.parseImageFromRequest(request, ''+userId);
        emptyCallback(null, 'one');
      },
      // function 2 : stores the details in the database
      function (emptyCallback) {
        log.info({email : userId}, 'LinkSocialMedia - Received request to link existing account with facebook');
        // Check if the user is already linked to a facebook account
        var queryParams = [userId];
        var query = 'SELECT fb_link FROM USERS WHERE userId = $1'
        queryExecute(query, queryParams, function (result) {
          if(result.error) {
            log.error({email : userId}, 'LinkSocialMedia - Error while querying if the user had a facebook account linked\n' + result.error);
            var JSONObj = {"error":true, "message":"Database Error"};
            response.send(JSONObj);
          }
          else if(result.result.rowCount > 0 && result.result.rows[0].fb_link) {
            log.error({email : userId}, 'LinkSocialMedia - Found a linked facebook account ' + result.result.rows[0].fb_link);
            var JSONObj = {"error":false, "message":"Already linked"};
            response.send(JSONObj);
          }
          else if (result.result.rowCount > 0  && !result.result.rows[0].fb_link) {
            log.info({email : userId}, 'LinkSocialMedia - Creating a new social media link');
              // Insert a new row in facebook_accounts table first
              var queryParams = [facebookUserId, userAccessToken, facebookEmail];
              var query = 'INSERT INTO facebook_accounts(facebook_user_id, user_access_token, facebook_email) ' +
                          'VALUES ($1, $2, $3) RETURNING id;';
              queryExecute(query, queryParams, function (result) {
                if(result.error) {
                  log.error({email : userId}, 'LinkSocialMedia - Error while inserting into the facebook_accounts table\n' + result.error);
                  var JSONObj = {"error":true, "message":"Database Error"};
                  response.send(JSONObj);
                }
                else if(result.result.rowCount == 0){
                  log.error({email : userId}, 'LinkSocialMedia - 0 Rows added while inserting into facebook_accounts');
                  var JSONObj = {"error":true, "message":"Database Error"};
                  response.send(JSONObj);
                }
                else {
                  log.info({email : userId}, 'LinkSocialMedia - successfully updated the facebook_accounts table with new values.');
                  // Continue to add to users table
                  fbLink = result.result.rows[0].id;
                  // user was registered before, so update the changes/new values
                  var updateFields = request.query.updateFields;
                  if(updateFields == 'true' || updateFields == true) {
                    var queryParams = [name, gender, profile_picture, fbLink, userId];
                    var query = 'UPDATE users ' +
                                'SET name = $1, gender = $2, profile_picture = $3, fb_link = $4 ' +
                                'WHERE userId = $5';
                    } // End of if(updateFileds = true)
                    else {
                      var queryParams = [fbLink, userId];
                      var query = 'UPDATE users ' +
                                  'SET fb_link = $1' +
                                  'WHERE userId = $4';
                    }
                    queryExecute(query, queryParams, function (result) {
                      if(result.error) {
                        log.error({email : userId}, 'Error while updating the users table with facebook changes.\n' + result.error);
                        var JSONObj = {"error":true, "message":"Database Error"};
                        response.send(JSONObj);
                        login.deleteFromFacebookAccounts(fbLink, userId);
                      }
                      else if(result.result.rowCount == 0){
                        log.error({email : userId}, 'LinkSocialMedia -  Did not find the user with this id');
                        var JSONObj = {"error":true, "message":"Server error", 'details':'Could not find the user with this userId'};
                        response.send(JSONObj);
                        login.deleteFromFacebookAccounts(fbLink, userId);
                      }
                      else if(result.result.rowCount > 1){
                        log.error({email : userId}, 'SEVERE ERROR');
                        log.error({email : userId}, 'LinkSocialMedia -  More than one row was updated in users');
                        var JSONObj = {"error":true, "message":"Server Error", "details":"SEVERE ERROR : Multiple rows created with one update statement"};
                        response.send(JSONObj);
                        login.deleteFromFacebookAccounts(fbLink, userId);
                      }
                      else {
                        log.info({email : userId}, 'LinkSocialMedia -  successfully updated the users table with new values.');
                        var JSONObj = {"error":false, "message":"Link successful"};
                        response.send(JSONObj);
                      }
                    }) // End of queryExecute - Update users
                }  // End of else
              }) // End of queryExecute - Insert into facebook_accounts
          } // End of else if
          else {
            log.error({email : userId}, 'LinkSocialMedia -  Did not find the specified user.');
            var JSONObj = {"error":true, "message":"User not found"};
            response.send(JSONObj);
          }
        }) // End of queryExecute - Select fb_link from users
        emptyCallback(null, 'two');
      } // End of function 2
    ]);
  }
  else {
    log.error({user : userId}, 'LinkSocialMedia - This type of social media cannot be connected. ' + type);
  }
}


function emptyCallback(error, results) {
  // Do nothing
}
