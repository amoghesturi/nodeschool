var ip = require('ip'); // To fetch the ip address\
var path = require('path');

var username, password, ipaddress; // IPE's username, password and the address where the API resides
var systemUser = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'].split(path.sep)[2];
var tempFileLocation; // Folder where the temperory images are stored while sending them to the clients
var port = 8080;
tempFileLocation = (process.platform == 'win32') ? 'C:/Users/' + systemUser + "/Documents/temp/" : '/home/' + systemUser + "/temp/";

if(process.env.DB_ENV == 'DEV') {
  username = 'awmbjd4jdscl57gc4b6r';
  password = 'inZ24dEyPumx1OY1';
  ipaddress =  'http://' + ip.address() + ':' + port;
}
else if(process.env.DB_ENV == 'STG') {
  username = 'awmbjd4jdscl57gc4b6r';
  password = 'inZ24dEyPumx1OY1';
  ipaddress = 'http://' + ip.address();
}
else if(process.env.DB_ENV == 'PROD') {
  username = '3pplxqfnguaw0ljfitwz';
  password = '9zn8B4THxtB1xJaU';
  ipaddress = 'https://umed.vimsel.com';
}

module.exports.constants = {
  port : port,

  USERNAME : username,
  PASSWORD : password,

  URL_ECHO : 'http://api.moodstocks.com/v2/echo/?foo=bar&bacon=chunky',
  URL_RECOGNIZE : 'http://api.moodstocks.com/v2/search',
  URL_UPLOAD : 'http://api.moodstocks.com/v2/ref/',
  URL_DELETE : 'http://api.moodstocks.com/v2/ref/',

  IP : ipaddress,

  TEMP_FOLDER : tempFileLocation
};
