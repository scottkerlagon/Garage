var NodeWebcam = require( "node-webcam" );
var http = require('http').createServer(handler); //require http server, and create server with function handler()
var fs = require('fs'); //require filesystem module
var io = require('socket.io')(http) //require socket.io module and pass the http object (server)
const piGpio = require('pigpio').Gpio;
var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var relay1 = new Gpio(20, 'out'); //use GPIO pin 20 as output
var relay2 = new Gpio(21, 'out'); //use GPIO pin 21 as output

//Ultra Sonic Code
// The number of microseconds it takes sound to travel 1cm at 20 degrees celcius
const MICROSECDONDS_PER_CM = 1e6/34321;
const trigger = new piGpio(12, {mode: piGpio.OUTPUT});//16
const echo = new piGpio(16, {mode: piGpio.INPUT, alert: true});//12
trigger.digitalWrite(0); // Make sure trigger is low

// const watchHCSR04 = () => {
  // console.log('Start watching');
  // let startTick;

  // echo.on('alert', (level, tick) => {
    // if (level == 1) {
      // startTick = tick;
    // } else {
      // const endTick = tick;
      // const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic
      // var inches = (Math.round((diff / 2 / MICROSECDONDS_PER_CM)*.3937008 * 100) / 100);
      // console.log(inches + 'in');
	  // socket.emit('distanceChanged', inches);
    // }
  // });
// };

//watchHCSR04();

// Trigger a distance measurement once per second
setInterval(() => {
  trigger.trigger(10, 1); // Set trigger high for 10 microseconds
}, 100);
//End Ultra Sonic Code

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
	var contents = fs.readFileSync('serverCode.txt', 'utf8');
  return contents;
}

const serverCode = getServerCode();

function validatePassword(password) {
  if(password === serverCode)
    return 1;
  else
  {
    console.log('Password is wrong');
    return 0;
  }
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
	const watchHCSR04 = () => {
	  console.log('Start watching');
	  let startTick;

	  echo.on('alert', (level, tick) => {
		if (level == 1) {
		  startTick = tick;
		} else {
		  const endTick = tick;
		  const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic
		  var inches = (Math.round((diff / 2 / MICROSECDONDS_PER_CM)*.3937008 * 100) / 100);
		  console.log(inches + 'in');
		  socket.emit('distanceChanged', inches);
		}
	  });
	};

	watchHCSR04();

  var relay1Value = 0; //static variable for current status
  
  socket.on('takePicture', function(pwassWord, quality, width, height) {
    console.log('Taking Picture');
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
      if(err)
        console.log(err);
      socket.emit('pictureTaken', data);
    });
    Webcam.clear();
    //fs.unlinkSync(fileName);
  });
  
  socket.on('chargerDoor', function(data) {
    console.log('Toggling Charger Door');
    if(!validatePassword(data))
      return;
    relay1.writeSync(1);
    sleep(750);
    relay1.writeSync(0);
  });
  
  socket.on('vanDoor', function(data) {
    console.log('Toggling Van Door');
    if(!validatePassword(data))
      return;
    relay2.writeSync(1);
    sleep(750);
    relay2.writeSync(0);
  });
});

//process.on('SIGINT', cleanUp); //on ctrl+c
process.on('SIGINT', function (){  //on ctrl+c
  console.log('In SIGINT');
  relay1.writeSync(0); // Turn relay1 off
  relay2.writeSync(0); // Turn relay2 off
  relay1.unexport(); // Unexport relay1 GPIO to free resources
  relay2.unexport(); // Unexport relay2 GPIO to free resources
  //unwatchAll();
  process.exit(); //exit completely
});

//process.on('uncaughtException', cleanUp); //on exception
process.on('uncaughtException', function (err){ //on exception
  console.log('In Uncuaght Exception');
  console.log(err);
  relay1.writeSync(0); // Turn relay1 off
  relay2.writeSync(0); // Turn relay2 off
  relay1.unexport(); // Unexport relay1 GPIO to free resources
  relay2.unexport(); // Unexport relay2 GPIO to free resources
  //unwatchAll();
  process.exit(); //exit completely
});
function cleanUp(){
	relay1.writeSync(0); // Turn relay1 off
	relay2.writeSync(0); // Turn relay2 off
	relay1.unexport(); // Unexport relay1 GPIO to free resources
	relay2.unexport(); // Unexport relay2 GPIO to free resources
	//unwatchAll();
	process.exit(); //exit completely
}
