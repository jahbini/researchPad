	// SensorTag object.
	var sensortag = evothings.tisensortag.createInstance();
	var recording = false;
 var reading,
    	readings;
	    
function countReadings(){
		displayValue('TotalReadings',readings.length);
	}
    function initAll(){
     var rtemp; 
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
    
    function uploadData(){
    	var hopper,brainDump;
    	recording = false;
     hopper = Backbone.Model.extend({url:"/trajectory"});
     brainDump = new hopper({readings: readings});
     brainDump.save();
     readings.reset();
    }
    
	function initialiseSensorTag()
	{
     
		//
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
		sensortag
			.statusCallback(statusHandler)
			.errorCallback(errorHandler)
			.keypressCallback(keypressHandler)
			.accelerometerCallback(accelerometerHandler, 200)
			.magnetometerCallback(magnetometerHandler, 200)
			.gyroscopeCallback(gyroscopeHandler, 200, 7) // 7 = enable all axes.
			.connectToClosestDevice()
	}

	function statusHandler(status)
	{
		if ('Device data available' == status)
		{
			displayValue('FirmwareData', sensortag.getFirmwareString())
		}
		displayValue('StatusData', status)
	}

	function errorHandler(error)
	{
		console.log('Error: ' + error)
		if ('disconnected' == error)
		{
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
$(function(){
	initAll();
	$("#record").click(function(){recording=true;})
	$("#upload").click(function(){recording=false; uploadData(); })
	$("#reset").click(function(){recording=false; readings.reset(); })
	$(document).on('deviceready', initialiseSensorTag );

});	
