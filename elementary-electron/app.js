var electron = require('electron')

electron.app.on('ready', function () {
  var mainWindow = new electron.BrowserWindow({width: 600, height: 800});
  console.log(__dirname + '/index.html');
  mainWindow.loadURL('file://' + __dirname + '/index.html');
})
