var queryExecute = require('./Database/QueryExecute');
var log = require('../Configuration/BunyanConfig').log;

module.exports = function(request, response) {
  var bindingParameters = {
    request : request,
    response : response,
    title : request.query.pageTitle
  }
  var title = request.query.pageTitle;
  var details = request.body.details;
  var queryParameters = {};

  if (title == 'ALL USERS') {
    query = 'SELECT U.id, U.email, U.verificationstatus, FA.facebook_email from users U ' +
            'LEFT JOIN facebook_accounts FA on FA.id = U.fb_link  ORDER BY id desc LIMIT 3000';
  }
  else if (title == 'PENDING USERS') {
    query = 'SELECT id, email from users where verificationstatus=\'PENDING\' ORDER BY id DESC LIMIT 3000'
  }
  queryExecute(query, queryParameters, queryCallback.bind(bindingParameters));
}

function queryCallback(result) {
  if(result.error) {
    log.error({'user':'admin'}, 'Error while getting details for ' + this.title + result.error);
  }
  else {
    log.info({'user':'admin'}, 'successfully obtained query result.');
    var decodedDetails = JSON.stringify(result.result.rows);
    decodedDetails = decodedDetails.replace("[", "");
    decodedDetails = decodedDetails.replace("]", "");
    var splitdetails = decodedDetails.split('},');
    var detailsToDisplay = this.title + '</br></br>';
    for(i = 0; i < splitdetails.length; i++) {
      detailsToDisplay = detailsToDisplay + splitdetails[i] + '}</br>';
    }
    this.response.send(detailsToDisplay);
  }
}
