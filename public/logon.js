console.log('my new logon.js loaded - live system with events');
console.log('entering timer logon.js of 11-2018')

/*global Pylon*/
/*global evothings*/
/*global $*/

if (typeof(evothings) == "undefined") { var evothings = window}   // make this work with evothings or not.....

var nTimers
var timerNo
var beamBroken   // current beam state
var beamBlocked  // set on first block for each timer
var done		// turns true after both beams have been blocked
var walking                    // approximate amount of walk time, shown on screen
var walkStart, walkEnd
var Itimer			// ID of onscreen timer function
var Iscan			// ID of rescan function
var movingUp
var increasing
var movingTime
var timerIDs
var lastName
var minIDs = 4
var timer
var tStart
var deltaT
var updateTime
var breakTime // THIS IS THE ANSWER!!!!
var timeRes = 100 // clock ticks on screen
var minTimeout = 500   // seen any changes during this time frame?
var deltaInc = 2      // assume clock must have drifted a bit
var restartScan = 10*1000  // restart the scan every 10 seconds (why!?!?!)

var timerMatch = /^retrotope-timer\(([01])\)(\d+)$/

// assume that the two motion sensors were found and mounted....
// check for two timer devices

var tno = function(address) {
		if (timer[0] == address) { return 0 }
		if (timer[1] == address) { return 1 }
		return -1     // error condition.....
};

var walkTimer = function() {
	walking += timeRes
	var walkString = "Walk time: " + (walking/1000).toFixed(2) + "  sec."
	//console.log(walkString)
	$('#duration-report').show().html("<h3>"+walkString+"<h3>");  
};

var walkNow = function() {          // call me each tinme at the beginning of each walk
	shutDown()     // make sure all's quiet on the western front
	timerIDs = {}      // start looking at sensor advertisers
	nTimers = 0
	timer = ["NotSeen","NotSeen"]
	lastName = "NotSeen"
	movingTime = [99999999,99999999]
	walking = 0   // approx. amount of time between first and second beam block
	tStart = parseInt(Date.now())
	deltaT = [0,0]
	updateTime = [tStart,tStart]
	breakTime = [tStart,tStart]
	done = false
	beamBlocked = [false, false]
	beamBroken = [false, false] 
	movingUp = [false, false]
	increasing = false
	console.log('Looking for timers.....')
	$('#duration-report').show().html("<h3>Looking for timers...<h3>")
	evothings.ble.startScan([],findSensors,BLEerror);  // this finds the sensors and does the timing
};

var shutDown = function() {
  $('#duration-report').hide()
	evothings.ble.stopScan() // stop scanning
	clearInterval(Iscan)
	clearInterval(Itimer)
	
};

var reScan = function () {
	evothings.ble.stopScan()
	if (!done) {evothings.ble.startScan([],timeSensors,BLEerror)}
};

var BLEerror = function (error) {console.log('BLE scan failed: ' + error)
	shutDown()
};   // what else to do here?

var findSensors =  function (device) {   // this function makes sure we have two sensor pairs, seeing each other
	var result = timerMatch.exec(device.name)
	if (result != null)
		{  // found a timer
		//console.log("BLE:"+device.name+" Address: "+device.id)
		if (lastName == device.name) {return} // ignore sequential identical frames
		if (result[1] == "1") {return}        // make sure beam is broken
		lastName = device.name
		if (device.id in timerIDs) {timerIDs[device.id] += 1}
		else {timerIDs[device.id] = 1; return}
		if (timerIDs[device.id] < minIDs) {return}
		if (nTimers == 0) {timer[0] = device.id; nTimers = 1
			 console.log("Found one timer....")
			$('#duration-report').html("<h3>Found one timer...<h3>")
			}
		else if ((nTimers == 1) && (device.id != timer[0]))
			{timer[1] = device.id; nTimers = 2
			console.log("Found both timers....")
			$('#duration-report').html("<h3>Found both timers<h3>")
			// console.log(timerIDs)
			evothings.ble.stopScan()
			evothings.ble.startScan([],timeIncreasing,BLEerror)}  // found them both, now wait for times increasing
	}
};

var timeIncreasing = function (device) {   // wait until both timers are moving forward, to eliminate any garbage values at startup
	if (increasing) {return}     // don't ever come back here!
	var result = timerMatch.exec(device.name)
	if (result != null)
		{  // found a timer
		timerNo = tno(device.id)
		if (timerNo == -2) {return}
		var zTime = parseInt(result[2])
		if (result[1] == "0") {  		// beam is not broken, check that times are going up
    			if (movingTime[timerNo] >= zTime) {movingTime[timerNo] = zTime}
    			else {
    			movingUp[timerNo] = true
    			deltaT[timerNo] = parseInt(Date.now()) - parseInt(result[2])
    			}
    			if (movingUp[0] && movingUp[1]) { // both moving up, start truly timing
    				increasing = true
              			Iscan = setInterval(reScan,restartScan)    // stop and restart scanning periodically
              			evothings.ble.stopScan()
    				evothings.ble.startScan([],timeSensors,BLEerror)} } // now wait for beam breaks
		}
};

var timeSensors =  function (device) {       // here we actually monitor the beam for breaks
	var result = timerMatch.exec(device.name)
	if (result != null)
	   {  // found a timer
	   var sensorTime = parseInt(result[2])
	   var localTime = parseInt(Date.now())
	   timerNo = tno(device.id)
	   if (timerNo == -2) {return}
       	   if (result[1] == "0") {  		// beam is not broken
    		var newDelta = localTime - sensorTime
            	if (beamBroken[timerNo]) {   // first packet after beam no longer broken
            		beamBroken[timerNo] = false
            		}
            	if (newDelta < deltaT[timerNo]) {
					deltaT[timerNo] = newDelta}
		if (newDelta == deltaT[timerNo]) {updateTime[timerNo] = localTime}
		if ((localTime - updateTime[timerNo]) > minTimeout) { deltaT[timerNo] += deltaInc  // if min delta not seen, try again
        	updateTime[timerNo] = localTime
			}
                }
	   else if (result[1] == "1")  {		// beam is broken
			if (!beamBroken[timerNo])  {    // the first transition to broken!!! Ignore all the rest
				beamBroken[timerNo] = true
				beamBlocked[timerNo] = true
      				breakTime[timerNo] = deltaT[timerNo] + sensorTime   // that's it!!! Send an ActionEvent to server with breakTime and the timerNo
      				var breakStr = [Date.now(),breakTime[timerNo],timerNo].join()
      				console.log("beam break: "+breakStr)
      				Pylon.trigger("systemEvent:beamBreak:" + timerNo + "," + breakTime[timerNo])
				if (beamBlocked[0] != beamBlocked[1]) {walkStart = breakTime[timerNo]
				  Itimer = setInterval(walkTimer,timeRes)  // start timer on first beam block
				  }
				else {walkEnd = breakTime[timerNo]         // stop timer on second beam block
				done = true
				evothings.ble.stopScan() // stop scanning
				clearInterval(Itimer)  // stop timer
				var walkString = "Walk time: " + ((walkEnd-walkStart)/1000).toFixed(2) + " sec."
				console.log(walkString)
				$('#duration-report').html("<h3>"+walkString+"<h3>");  // this value is shown on the screen for recording, until Accept or Reject is pressed.	
				}
  		   }
 	    }
      }
};
// app triggers on begin and end of protocol
Pylon.on("systemEvent:externalTimer:show",walkNow);
Pylon.on("systemEvent:stopCountDown:over",shutDown);
console.log('logon.js done');
/*Retrotope App Version  "2.9.8-test" */
/*Retrotope App Version  "3.0.1-test" */
/*Retrotope App Version  "3.0.1-test" */
/*Retrotope App Version  "3.0.2-test" */
/*Retrotope App Version  "3.0.3-test" */
/*Retrotope App Version  "3.0.4-test" */
/*Retrotope App Version  "3.0.5-test" */
/*Retrotope App Version  "3.0.6-test" */
/*Retrotope App Version  "3.0.7-test" */
/*Retrotope App Version  "3.0.8-test" */
/*Retrotope App Version  "3.0.9-test" */
/*Retrotope App Version  "3.1.0-test" */
/*Retrotope App Version  "3.1.1-test" */
/*Retrotope App Version  "3.1.2-test" */
/*Retrotope App Version  "3.1.3-test" */
/*Retrotope App Version  "3.1.4-test" */
/*Retrotope App Version  "3.1.4-test" */
/*Retrotope App Version  "3.1.4-test" */
/*Retrotope App Version  "3.1.4-test" */
