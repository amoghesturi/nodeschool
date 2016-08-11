var express = require('express');
var bodyParser = require('body-parser');
var log = require('../Configuration/BunyanConfig').log;

var recognizeImage = require('../Implementation/RecognizeImage');
var uploadImage = require('../Implementation/UploadImage/UploadImage');
var removeImage = require('../Implementation/RemoveImage');
var updateImage = require('../Implementation/UpdateImage');
var constants = require('../Utils/Constants').constants;
var register = require('../Implementation/Register');
var login = require('../Implementation/Login');
var emailValidation = require('../Implementation/EmailValidation');
var removeEvent = require('../Implementation/RemoveEvent');
var submitRating = require('../Implementation/SubmitRating');
var adminPortal = require('../Implementation/AdminPortal');
var authenticateAdmin = require('../Implementation/AunthenticateAdmin');
var showDetails = require('../Implementation/ShowDetails');
var resendVerification = require('../Implementation/ResendVerification');
var forgotPassword = require('../Implementation/ForgotPassword/ForgotPassword');
var restoreImageData = require('../Implementation/Restore/RestoreImageData');
var restoreSkeleton = require('../Implementation/Restore/RestoreSkeleton');
var getApprarelDetails = require('../Implementation/GetApprarelDetails');
var addImagesToEvents = require('../Implementation/AddImagesToEvents');
var getEventHistory = require('../Implementation/GetEventHistory');
var linkSocialMedia = require('../Implementation/LinkSocialMedia');
var unlinkSocialMedia = require('../Implementation/UnlinkSocialMedia');

log.info("Starting webservice in " + process.env.WS_ENV + " Environment");

var expressApp = express();
//Express configuration for email template
expressApp.listen(constants.port);
expressApp.engine('html', require('ejs').renderFile);
expressApp.set('views', __dirname + '/views');
expressApp.set('view engine', 'html');

expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({extended : true}));
// Middleware for handling client timeouts
expressApp.use(function (req, res, next) {
  var bindingParams = {
    req : req,
    res : res,
    next : next
  };
  res.processComplete = false;
  res.clientTimeOut = false;
  req.connection.addListener('close', handleClientTimeout.bind(bindingParams));
  next();
});

function handleClientTimeout() {
  var pc = this.res.processComplete;
  if(!pc) {
    this.res.clientTimeOut = true;
  }
}

// Create a web service which takes image from mobile client and sends it to
// image processing engine for results. It then updates the database based on
// the response obtained and sends the response back to the client.
expressApp.post('/recognize/:userId', recognizeImage);

// Upload Image to the image processing engine training data set
expressApp.put('/upload/:imageId', uploadImage);

// Removes image from the everywhere
expressApp.delete('/remove/:imageId', removeImage);

// Updates image metadata
expressApp.post('/update/:imageId', updateImage);

// Sign up or Register User end point
expressApp.post('/register', register.register);

// End point for users to log in
expressApp.post('/login', login.login);

// End point to verify the user specific email link
expressApp.get('/validatemyemail', emailValidation);

// End Point to remove the events
expressApp.delete('/removeevent/:userId/:eventId', removeEvent);

// End Point to add email to the wait list -- DEPRECATED
// expressApp.post('/waitlist', addToWaitList);

// End Point to send ratings
expressApp.post('/ratings', submitRating);

// End point to resendd the email verification link
expressApp.post('/resendVerification', resendVerification);

// End Point to perform admin queries
expressApp.get('/adminPortal', adminPortal);
expressApp.post('/authenticateAdmin', authenticateAdmin);
expressApp.post('/showDetails', showDetails);

// End Point for forgot password.
expressApp.post('/forgotPassword', forgotPassword);
expressApp.get('/forgotPassword', forgotPassword);

// End point for initial restore skeleton data
expressApp.get('/restoreData/skeleton/:userId', restoreSkeleton);

// End point to send the requested image to the client.
expressApp.get('/restoreData/image/:imageId', restoreImageData);

// End point to get all the details of the image
expressApp.get('/getApparelDetails/:imageId', getApprarelDetails);

// End point to add images to the events
expressApp.post('/addImagesToEvents/:userId', addImagesToEvents);

// End points to get event history
expressApp.get('/getEventHistory/:userId', getEventHistory);

// End point to link social network to existing account
expressApp.post('/linkSocialMedia/:userId', linkSocialMedia);

// End point to remove link to social media
expressApp.post('/unlinkSocialMedia/:userId', unlinkSocialMedia);
