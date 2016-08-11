var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;
var register = require('./Register');
var multiparty = require('multiparty');
var fs = require('fs');
var async = require('async');
var readChunk = require('read-chunk');
var fileType = require('file-type');

module.exports.login = function (request, response) {
  // If the login request is facebook login
  if(request.query.type == 'facebook') {
    facebookLogin(request, response);
  }
  else {
    //initialize a new array to store email and password
    var credentials= [];
    credentials[0]= request.query.email.toLowerCase();
    credentials[1]= request.query.password;
    var bindingParams = {
      credentials : credentials,
      response : response
    }
    log.info({email : credentials[0]}, 'Login - Received request to login user ');

    //Look for user based on combincation of email and password provided
    log.info({email : credentials[0]}, 'Login - Sending query to get information about the account');
    var query = "SELECT userid,verificationstatus FROM users WHERE (email=$1 AND password=$2)";
    queryExecute(query, credentials, userPasswordQuerycallback.bind(bindingParams));
  }
}

function userPasswordQuerycallback(result) {
  var bindingParams = {
    credentials : this.credentials,
    response : this.response
  }
  if (result.error) {
    log.error({email : this.credentials[0]}, 'Login - Error getting user information from database');
    JSONObj= {"message":"Server Error.", "code":"0"};
    this.response.send(JSONObj);
  }
  //If no error occurs but there is no user with the given combination of
  //email and password.
  if (result.result.rowCount == 0){
    log.info({email : this.credentials[0]}, 'Login - Query with username and password returned no results');
    log.info({email : this.credentials[0]}, 'Login - Querying with only username/email');
    var query = "SELECT userid FROM users WHERE (email=$1)";
    //initialize new array with just email address of user.
    var email = [this.credentials[0]];
    //to check which credentials is incorrect while logging in, fetch userid
    //for the email address provided by user. If no rows are returned then
    //email address is invalid. otherwiese Password is incorrect.
		queryExecute(query, email, emailOnlyQueryCallback.bind(bindingParams));
  }
  //Check for the verification status of email address provided by user
  if (result.result.rowCount == 1)
	{
    //If verificationstatus is still PENDING, then deny login and advise the user
    //to perform email verification before logging in.
		if(result.result.rows[0].verificationstatus=='PENDING') {
      log.info({email : this.credentials[0]}, 'Login - User found and in PENDING state');
      // case 10 for activating resend verification button on client side
		  JSONObj={"message":"Email verification pending. Please check your email", "code":"0", "case":"10"}
    }
		else {
      // If no error occurs , then login in is Successful and send code 1.
      log.info({email : this.credentials[0]}, 'Login - Login successful.. ');
      // Sending the user id so that it can stay the same on client side even when the user changes Password
      // and logs in from a different system.
      JSONObj={"message":"Login Successful!!", "code":"1", "userId" : result.result.rows[0].userid};
    }
		this.response.send(JSONObj);
	}
}

function emailOnlyQueryCallback(result_credentials) {
  if (result_credentials.error) {
    log.error({email : this.credentials[0]}, 'Login - Error while querying if the user exists');
    JSONObj= {"message":err, "code":"0"};
    this.response.send(JSONObj);
  }
  if (result_credentials.result.rowCount==0){
    log.info({email : this.credentials[0]}, 'Login - Login Failed. Email not found.');
    JSONObj={"message":"Regrettably, we cannot find this email address, please correct.\n[Consider registering again.]", "code":"0"}
    this.response.send(JSONObj);
  }
  else{
    log.info({email : this.credentials[0]}, 'Login - Login failed. Password incorrect');
    JSONObj={"message":"Please check your password again.", "code":"0"}
    this.response.send(JSONObj);
  }
}

// Function for Facebook login
function facebookLogin(request, response) {
  //TODO : Check the size and type of profile_picture
  //initialize a new array to store email and password
  var facebookEmail = request.query.email.toLowerCase();
  var facebookUserId = request.query.facebookUserId;

  var userAccessToken = request.query.userAccessToken;
  var userId = request.query.userId;
  var email = request.query.email;
  if(email) {
    email = email.toLowerCase();
  }
  var name = request.query.name;
  var gender = request.query.gender;
  var profile_picture;
  log.info({email : 'facebook -' + facebookEmail}, 'Login - Entering facebook login function.');

  async.series([
    // Function 1
    function(emptyCallback) {
      profile_picture = module.exports.parseImageFromRequest(request, 'facebook - ' + facebookEmail);
      emptyCallback();
      }, // End of function 1

    // Begin function 2
    function (emptyCallback) {
      log.info({email : 'facebook -' + facebookEmail}, 'Login - Received request to login user with facebook');
      //Look for user based on combincation of email and password provided
      log.info({email : 'facebook -' + facebookEmail}, 'Login - Sending query to verify if the user is registered');
      var queryParams = [facebookUserId, facebookUserId+'@facebook.com'];
      console.log(queryParams);
      var query = "Select id, fb_link from users where fb_link in ( SELECT id from facebook_accounts where facebook_user_id = $1) AND email = $2";
      queryExecute(query, queryParams, function(verify_registration_result) {
        if (verify_registration_result.error) {
          log.error({email : 'facebook - ' + facebookEmail}, 'Login - Error while querying if the user is already registered or not\n' + verify_registration_result.error);
          var JSONObj= {"message":"Database Error.", "code":"0"};
          response.send(JSONObj);
          //TODO : Test on client if the message is right
        }

        // If the user is trying facebook login for the first time, he will not be registered.
        // He will now be registered and signed in
        else if (verify_registration_result.result.rowCount == 0) {
          // Check if the number of registered users is less than the max number of users
          var bindingParams = {
            email : facebookEmail,
            request : request,
            response : response
          };
          register.countUsers(bindingParams, function (returnValue) {
            if(returnValue.register == true) {
              // Register this user and grant login access
              // Insert into facebook_accounts table first
              var queryParams = [facebookUserId, userAccessToken, facebookEmail];
              var query = 'INSERT INTO facebook_accounts(facebook_user_id, user_access_token, facebook_email) ' +
                          'VALUES ($1, $2, $3) RETURNING id;';
              queryExecute(query, queryParams, function (result) {
                if(result.error) {
                  log.error({email : 'facebook - ' + facebookEmail}, 'Login - Error while inserting into the facebook_accounts table\n' + result.error);
                  var JSONObj= {"message":"Database Error.", "code":"0"};
                  response.send(JSONObj);
                }
                else if(result.result.rowCount == 0){
                  log.error({email : 'facebook - ' + facebookEmail}, 'Login - 0 Rows added while inserting into facebook_accounts');
                  var JSONObj= {"message":"Database Error.", "code":"0"};
                  response.send(JSONObj);
                }
                else {
                  log.info({email : 'facebook - ' + facebookEmail}, 'Login - successfully updated the facebook_accounts table with new values.');
                  // Continue to add to users table
                  var fbLink = result.result.rows[0].id;
                  var queryParams = ['' + facebookUserId + '@facebook.com', userId, name, 'VERIFIED', 'default_password', fbLink, gender, profile_picture]
                  var query = 'INSERT INTO users(email, userid, name, verificationstatus, password, fb_link, gender, profile_picture) ' +
                              'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING userid';
                  queryExecute(query, queryParams, function (result) {
                    if(result.error) {
                      log.error({email : 'facebook - ' + facebookEmail}, 'Login - Error while inserting into the users table\n' + result.error);
                      if(result.error.code == 23505) {
                        var JSONObj= {"message":"User already exists with this email address. Try logging in through the existing account to not loose your data.", "code":"0"};
                      }
                      else {
                        var JSONObj= {"message":"Database Error.", "code":"0"};
                      }
                      response.send(JSONObj);
                      module.exports.deleteFromFacebookAccounts(fbLink, 'facebook - ' + facebookEmail);
                    }
                    else if(result.result.rowCount == 0){
                      log.error({email : 'facebook - ' + facebookEmail}, 'Login - 0 Rows added while inserting into users');
                      var JSONObj= {"message":"Database Error.", "code":"0"};
                      response.send(JSONObj);
                      module.exports.deleteFromFacebookAccounts(fbLink, 'facebook - ' + facebookEmail);
                    }
                    else {
                      var JSONObj={"message":"Login Successful!!", "code":"1", "userId" : result.result.rows[0].userid};
                      response.send(JSONObj);
                    }
                  }) // End of queryExecute (insert into users - inside top)
                }
              }) // End of queryExecute (top)
            }
            else {
              // Response is already sent in the countUsers function
            }
          })
        }  // End of Registration

        // If the user was already registered either through facebook login or email signup
        else if(verify_registration_result.result.rowCount == 1) {
          // user was registered before, so update the changes/new values
          var updateFields = request.query.updateFields;
          if(updateFields == 'true' || updateFields == true) {
            var queryParams = [name, gender, profile_picture, verify_registration_result.result.rows[0].id];
            var query = 'UPDATE users ' +
                        'SET name = $1, gender = $2, profile_picture = $3 ' +
                        'WHERE id = $4 RETURNING userid';
            queryExecute(query, queryParams, function (result) {
              if(result.error) {
                log.error({email : 'facebook - ' + facebookEmail}, 'Error while updating the users table with facebook changes.\n' + result.error);
              }
              else if(result.result.rowCount == 0){
                log.error({email : 'facebook - ' + facebookEmail}, 'Login - Did not find the user with this id');
              }
              else if(result.result.rowCount > 1){
                log.error({email : 'facebook - ' + facebookEmail}, 'SEVERE ERROR');
                log.error({email : 'facebook - ' + facebookEmail}, 'Login - More than one row was updated in users');
              }
              else {
                log.info({email : 'facebook - ' + facebookEmail}, 'Login - successfully updated the users table with new values.');
              }
            }) // End of queryExecute
            queryParams = [userAccessToken, facebookEmail, verify_registration_result.result.rows[0].fb_link];
            query = 'UPDATE facebook_accounts ' +
                    'SET user_access_token = $1, facebook_email=$2 ' +
                    'WHERE id = $3';
            queryExecute(query, queryParams, function (result) {
              if(result.error) {
                log.error({email : 'facebook - ' + facebookEmail}, 'Error while updating the facebook_accounts table with facebook changes.\n' + result.error);
              }
              else if(result.result.rowCount == 0){
                log.error({email : 'facebook - ' + facebookEmail}, 'Login - Did not find the user with this facebook link');
              }
              else if(result.result.rowCount > 1){
                log.error({email : 'facebook - ' + facebookEmail}, 'SEVERE ERROR');
                log.error({email : 'facebook - ' + facebookEmail}, 'Login - More than one row was updated in facebook_accounts');
              }
              else {
                log.info({email : 'facebook - ' + facebookEmail}, 'Login - successfully updated the facebook_accounts table with new values.');
              }
            }) // End of queryExecute
          } // End of if(updateFileds = true)
          var JSONObj={"message":"Login Successful!!", "code":"1", "userId" : userId};
          response.send(JSONObj);
          // TODO : Add token up on merging with jwt branch
        }
      });
      emptyCallback(null, 'two');
    }  // End of function 2
  ], function (error, results) {
  });
} // End of facebookLogin

// Empty callback function to support async series
function emptyCallback(error, results) {
}

// Deletes the row from facebook_accounts table
// Used to revert from the tablefor complete transaction.
module.exports.deleteFromFacebookAccounts = function (id, email) {
  log.info({user : 'facebook - ' + email}, 'Login - Entering function to revert back new user created in facebook_accounts');
  var queryParams = [id];
  var query = 'DELETE FROM facebook_accounts WHERE id = $1';
  queryExecute(query, queryParams, function (result) {
    if(result.error) {
      log.error({user : 'facebook - ' + email}, 'Login - Could not delete the row from facebook_accounts\n' + result.error);
    }
    else if(result.result.rowCount == 1) {
      log.info({user : 'facebook - ' + email}, 'Login - Deleted the row with id ' + id + ' in facebook_accounts');
    }
    else {
      log.error({user : 'facebook - ' + email}, 'Login - Something else happened while trying to delete a row from facebook_accounts');
    }
  })
}

// Function that parses the image files from request and returns the image data
module.exports.parseImageFromRequest = function (request, userTag) {
  var imagedata;
  var multipartyForm = new multiparty.Form();
  multipartyForm.parse(request, function(err, fields, files) {
      if (err) {
        log.error({email : userTag}, 'Login - Error parsing the profile_picture.\n' + err);
      }
      else if(files.image_file){
        // Check for the file type
        var tempImagePath = files.image_file[0].path;
        var buffer = readChunk.sync(tempImagePath, 0, 10);
        var tempFileType = fileType(buffer);
        if(tempFileType != null && tempFileType.mime == 'image/jpeg') {
          // Read the contents of the temperory file into profile_picture
          log.info({user : userTag}, 'Login - Reading temperory file ' + tempImagePath);
          fs.readFile(tempImagePath, function (err, data) {
            if(err) {
              log.info({user : userTag}, 'Login - Error reading temperory file - profile picture ' + this.tempImagePath);
            }
            else {
              imagedata = data;
            }
          }); // End of readFile
        } // End of if (check file type)
        // If the image type did not match
        else {
          log.error({user : userTag}, 'Login - Content type did not match');
          // Delete the temperory file
          fs.unlink(files.image_file[0].path, function (err) {
            if (err) {
              log.error({user : userTag}, 'Login - Error deleting the temperory recognition file\n' + err);
             }
             else {
               log.info({user : userTag}, 'Login - Deleted temperory recognition file\n');
             }
          });  // End of fs.unlink
        }
      } // End of if no error
      else {
        // Image file did not exist
      }
      return imagedata;
    }); // End of multiparty parse
}
