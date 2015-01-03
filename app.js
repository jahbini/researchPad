	// SensorTag object.
	var sensortag = evothings.tisensortag.createInstance();
	var recording = false,
	 connected=false,
		reading,
		readings;
	
	function clearUserInterface(){
			// Clear current values.
			var blank = '[Waiting for value]';
			displayValue('StatusData', 'Ready to connect');
			displayValue('FirmwareData', '?');
			displayValue('KeypressData', blank);
			displayValue('AccelerometerData', blank);
			displayValue('MagnetometerData', blank);
			displayValue('GyroscopeData', blank);
			// Reset screen color.
			setBackgroundColor('white');
	 $(":button").prop("disabled",true);
		$("#stop").click(stopRecording);
		$("#record").click(enterRecording).fadeTo(0,1).text('record');
		
		$("#reset").prop("disabled",false);
	}

function countReadings(){
		displayValue('TotalReadings',readings.length);
	}
    function initAll(){
     var rtemp; 
     clearUserInterface();
     reading = Backbone.Model.extend(
     	{defaults:{sensor:'gyro',x:0,y:0,z:0},
     	 initialize: function(){var d= new Date(); 
     	 						this.set('time',d.getTime())}
     	});
     
     rtemp = Backbone.Collection.extend(
     	{
     		model:'reading',
     		initialize: function() {
     			this.on('add',countReadings);
     			this.on('remove',countReadings);
     			this.on('reset',countReadings);
     		}
     	});
     readings = new rtemp();
    }
    
    function enterUpload(){
    	var hopper,brainDump;
    	recording = false;
     hopper = Backbone.Model.extend({url:"/trajectory"});
     brainDump = new hopper({readings: readings});
     brainDump.save();
     readings.reset();
     enterConnected();
    }
    
	function initialiseSensorTag()
	{
		// Here sensors are set up.
		//
		// If you wish to use only one or a few sensors, just set up
		// the ones you wish to use.
		//
		// First parameter to sensor function is the callback function.
		// Several of the sensors take a millisecond update interval
		// as the second parameter.
		// Gyroscope takes the axes to enable as the third parameter:
		// 1 to enable X axis only, 2 to enable Y axis only, 3 = X and Y,
		// 4 = Z only, 5 = X and Z, 6 = Y and Z, 7 = X, Y and Z.
		//
		connected = false;
		sensortag
			.statusCallback(statusHandler)
			.errorCallback(errorHandler)
			.keypressCallback(keypressHandler)
			.accelerometerCallback(accelerometerHandler, 100)
			.magnetometerCallback(magnetometerHandler, 100)
			.gyroscopeCallback(gyroscopeHandler, 100, 7) // 7 = enable all axes.
			.connectToClosestDevice();
	}
function enterReset(){
	// legal to enter Reset from any state 
	reading = false;
	readings = null;
	sensortag.disconnectDevice();
	//sensortag = evothings.tisensortag.createInstance();
	initAll();
	initialiseSensorTag();
	setTimeout(
		function() { sensortag.connectToClosestDevice() },
		1000);
}

function enterConnected(){
	// enable the recording button
	connected = true;
	$("#record").prop('disabled',false).fadeTo(100,1).text('record').click(enterRecording);
}

function enterRecording(){
	$("#record").prop('disabled',true).text('recording').fadeTo(200,0.6);
	$("#stop").prop('disabled',false).fadeTo(100,1).click(enterReview);
	recording=true;
}

function enterReview(){
	$("#stop").prop('disabled',true).fadeTo(100,0.5);
	$("#record").prop('disabled',true).text('recorded').fadeTo(200,0.3);
	$("#upload").prop('disabled',false).click(enterUpload).fadeTo(100,1)
 recording=false;	
}

	function statusHandler(status)
	{
		if ('Sensors online' == status){
			enterConnected();
		}
		
		if ('Device data available' == status)
		{
			displayValue('FirmwareData', sensortag.getFirmwareString());
		}
		displayValue('StatusData', status);
	}
	function errorHandler(error)
	{
		console.log('Error: ' + error)
		if ('disconnected' == error)
		{
			connected = false;
			clearUserInterface();
			// If disconneted attempt to connect again.
			setTimeout(
				function() { sensortag.connectToClosestDevice() },
				1000)
		}
	}

	// calculations implemented as based on TI wiki pages
	// http://processors.wiki.ti.com/index.php/SensorTag_User_Guide

	function keypressHandler(data)
	{
		var left=0,right=0;
		// Update background color.
		switch (data[0])
		{
			case 0:
				setBackgroundColor('white');
				break;
			case 1:
				right=1;
				setBackgroundColor('red');
				break;
			case 2:
				left=1;
				setBackgroundColor('blue');
				break;
			case 3:
				right=1;
				left=1;
				setBackgroundColor('magenta');
				break;
		}
				if(recording) readings.push( new reading({sensor:'button',left:left,right:right}));

		// Update the value displayed.
		var string = 'raw: 0x' + bufferToHexStr(data, 0, 1);
		displayValue('KeypressData', string);
	}
	function templater(x,y,z,sensor,unit){
	
			return  sensor+ ' x=' + (x >= 0 ? '+' : '') + x.toFixed(5) + unit +' -- '
			+ 'y=' + (y >= 0 ? '+' : '') + y.toFixed(5) + unit + ' -- '
			+ 'z=' + (z >= 0 ? '+' : '') + z.toFixed(5) + unit;
	}

	function accelerometerHandler(data)
	{
		// Calculate the x,y,z accelerometer values from raw data.
		var values = sensortag.getAccelerometerValues(data);
		var x = values.x;
		var y = values.y;
		var z = values.z;
		if(recording) readings.push( new reading({sensor:'accel',x:x,y:y,z:z}));
		// Update the value displayed.
		displayValue('AccelerometerData', templater(x,y,z,'accel','G') );
	}

	function magnetometerHandler(data)
	{
		// Calculate the magnetometer values from raw sensor data.
		var values = sensortag.getMagnetometerValues(data)
		var x = values.x
		var y = values.y
		var z = values.z
		if(recording) readings.push( new reading({sensor:'mag',x:x,y:y,z:z}));

		// Update the value displayed.
		displayValue('MagnetometerData', templater(x,y,z,'mag','&micro;T'))
	}

	function gyroscopeHandler(data)
	{
		// Calculate the gyroscope values from raw sensor data.
		var values = sensortag.getGyroscopeValues(data);
		var x = values.x;
		var y = values.y;
		var z = values.z;
		if(recording) readings.push( new reading({x:x,y:y,z:z})) ;

		// Update the value displayed.
		displayValue('GyroscopeData', templater(x,y,z,'gyro',''));
	}

	function displayValue(elementId, value)
	{
		document.getElementById(elementId).innerHTML = value
	}

	function setBackgroundColor(color)
	{
		document.documentElement.style.background = color
		document.body.style.background = color
	}

	/**
	 * Convert byte buffer to hex string.
	 * @param buffer - an Uint8Array
	 * @param offset - byte offset
	 * @param numBytes - number of bytes to read
	 * @return string with hex representation of bytes
	 */
	function bufferToHexStr(buffer, offset, numBytes)
	{
		var hex = ''
		for (var i = 0; i < numBytes; ++i)
		{
			hex += byteToHexStr(buffer[offset + i])
		}
		return hex
	}

	/**
	 * Convert byte number to hex string.
	 */
	function byteToHexStr(d)
	{
		if (d < 0) { d = 0xFF + d + 1 }
		var hex = Number(d).toString(16)
		var padding = 2
		while (hex.length < padding)
		{
			hex = '0' + hex
		}
	}

 /*document.addEventListener('deviceready', initialiseSensorTag, false); */
 /*
 document.addEventListener('deviceready', initAll, false);
*/
function stopRecording(){
	if (recording) {
		recording = false;
	$("#record").prop('disabled',true).text('finished').fadeTo(200,0.3);
	}
}

$(function(){
	initAll();
	$("#reset").prop('disabled',false).fadeTo(0,1).click(enterReset);
	$(document).on('deviceready', initialiseSensorTag );

});	
