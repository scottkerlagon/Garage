var NodeWebcam = require( "node-webcam" );
var http = require('http').createServer(handler); //require http server, and create server with function handler()
var fs = require('fs'); //require filesystem module
var io = require('socket.io')(http) //require socket.io module and pass the http object (server)
var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var relay1 = new Gpio(20, 'out'); //use GPIO pin 20 as output
var relay2 = new Gpio(21, 'out'); //use GPIO pin 21 as output

http.listen(8080); //listen to port 8080

function handler (req, res) { //create server
  fs.readFile(__dirname + '/public/relays.html', function(err, data) { //read file index.html in public folder
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/html'}); //display 404 on error
      return res.end("404 Not Found");
    } 
    res.writeHead(200, {'Content-Type': 'text/html'}); //write HTML
    res.write(data); //write data from index.html
    return res.end();
  });
}

function getServerCode(){ 
	var contents = fs.readFileSync('webCode.txt', 'utf8');
	serverCode = contents;
}

var serverCode = getServerCode();

function validatePassword(password) {
  if(password === serverCode)
    return 1;
  else
    return 0;
}

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

io.sockets.on('connection', function (socket) {// WebSocket Connection
  var relay1Value = 0; //static variable for current status
  
  socket.on('takePicture', function(pwassWord, quality, width, height) {
    if(!validatePassword(pwassWord))
      return;
    var opts = { width: width, height: height, quality: quality, delay: 0,
       saveShots: false, output: "jpeg", device: false, 
      //callbackReturn: "location", 
      callbackReturn: "base64",
      verbose: false };
    var Webcam = NodeWebcam.create( opts );
    var fileName  = 'images/image-' + Date.now();
    
    NodeWebcam.capture( fileName, opts, function( err, data ) {
        socket.emit('pictureTaken', data);
    });
    Webcam.clear();
    //fs.unlinkSync(fileName);
  });
  
  socket.on('chargerDoor', function(data) {
    if(!validatePassword(data))
      return;
    relay1.writeSync(1);
    sleep(750);
    relay1.writeSync(0);
  });
  
  socket.on('vanDoor', function(data) {
    if(!validatePassword(data))
      return;
    relay2.writeSync(1);
    sleep(750);
    relay2.writeSync(0);
  });
});

process.on('SIGINT', function () { //on ctrl+c
  relay1.writeSync(0); // Turn relay1 off
  relay2.writeSync(0); // Turn relay2 off
  relay1.unexport(); // Unexport relay1 GPIO to free resources
  relay2.unexport(); // Unexport relay2 GPIO to free resources
  process.exit(); //exit completely
});

process.on('uncaughtException', function () { //on exception
  relay1.writeSync(0); // Turn relay1 off
  relay2.writeSync(0); // Turn relay2 off
  relay1.unexport(); // Unexport relay1 GPIO to free resources
  relay2.unexport(); // Unexport relay2 GPIO to free resources
  process.exit(); //exit completely
});