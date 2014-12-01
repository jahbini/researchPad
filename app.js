	// SensorTag object.
	var sensortag = evothings.tisensortag.createInstance()

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
			.irTemperatureCallback(irTemperatureHandler, 500)
			.humidityCallback(humidityHandler)
			.barometerCallback(barometerHandler, 500)
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
			var blank = '[Waiting for value]'
			displayValue('StatusData', 'Ready to connect')
			displayValue('FirmwareData', '?')
			displayValue('KeypressData', blank)
			displayValue('IRTemperatureData', blank)
			displayValue('AccelerometerData', blank)
			displayValue('HumidityData', blank)
			displayValue('MagnetometerData', blank)
			displayValue('BarometerData', blank)
			displayValue('GyroscopeData', blank)

			// Reset screen color.
			setBackgroundColor('white')

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
		// Update background color.
		switch (data[0])
		{
			case 0:
				setBackgroundColor('white')
				break;
			case 1:
				setBackgroundColor('red')
				break;
			case 2:
				setBackgroundColor('blue')
				break;
			case 3:
				setBackgroundColor('magenta')
				break;
		}

		// Update the value displayed.
		var string = 'raw: 0x' + bufferToHexStr(data, 0, 1)
		displayValue('KeypressData', string)
	}

	function irTemperatureHandler(data)
	{
		// Calculate temperature from raw sensor data.
		var values = sensortag.getIRTemperatureValues(data)
		var ac = values.ambientTemperature
		var af = sensortag.celsiusToFahrenheit(ac)
		var tc = values.targetTemperature
		var tf = sensortag.celsiusToFahrenheit(tc)

		// Prepare the information to display.
		var string =
			'raw: 0x' + bufferToHexStr(data, 0, 4) + '<br/>'
			+ (tc >= 0 ? '+' : '') + tc.toFixed(2) + '&deg; C '
			+ '(' + (tf >= 0 ? '+' : '') + tf.toFixed(2) + '&deg; F)' + '<br/>'
			+ (ac >= 0 ? '+' : '') + ac.toFixed(2) + '&deg; C '
			+ '(' + (af >= 0 ? '+' : '') + af.toFixed(2) + '&deg; F) [amb]' + '<br/>'

		// Update the value displayed.
		displayValue('IRTemperatureData', string)
	}

	function accelerometerHandler(data)
	{
		// Calculate the x,y,z accelerometer values from raw data.
		var values = sensortag.getAccelerometerValues(data)
		var x = values.x
		var y = values.y
		var z = values.z

		// Prepare the information to display.
		string =
			'raw: 0x' + bufferToHexStr(data, 0, 3) + '<br/>'
			+ 'x = ' + (x >= 0 ? '+' : '') + x.toFixed(5) + 'G<br/>'
			+ 'y = ' + (y >= 0 ? '+' : '') + y.toFixed(5) + 'G<br/>'
			+ 'z = ' + (z >= 0 ? '+' : '') + z.toFixed(5) + 'G<br/>'

		// Update the value displayed.
		displayValue('AccelerometerData', string)
	}

	function humidityHandler(data)
	{
		// Calculate the humidity values from raw data.
		var values = sensortag.getHumidityValues(data)

		// Calculate the humidity temperature (C and F).
		var tc = values.humidityTemperature
		var tf = sensortag.celsiusToFahrenheit(tc)

		// Calculate the relative humidity.
		var h = values.relativeHumidity

		// Prepare the information to display.
		string =
			'raw: 0x' + bufferToHexStr(data, 0, 4) + '<br/>'
			+ (tc >= 0 ? '+' : '') + tc.toFixed(2) + '&deg; C '
			+ '(' + (tf >= 0 ? '+' : '') + tf.toFixed(2) + '&deg; F)' + '<br/>'
			+ (h >= 0 ? '+' : '') + h.toFixed(2) + '% RH' + '<br/>'

		// Update the value displayed.
		displayValue('HumidityData', string)
	}

	function magnetometerHandler(data)
	{
		// Calculate the magnetometer values from raw sensor data.
		var values = sensortag.getMagnetometerValues(data)
		var x = values.x
		var y = values.y
		var z = values.z

		// Prepare the information to display.
		string =
			'raw: 0x' + bufferToHexStr(data, 0, 6) + '<br/>'
			+ 'x = ' + (x >= 0 ? '+' : '') + x.toFixed(5) + '&micro;T <br/>'
			+ 'y = ' + (y >= 0 ? '+' : '') + y.toFixed(5) + '&micro;T <br/>'
			+ 'z = ' + (z >= 0 ? '+' : '') + z.toFixed(5) + '&micro;T <br/>'

		// Update the value displayed.
		displayValue('MagnetometerData', string)
	}

	function barometerHandler(data)
	{
		// Prepare the information to display.
		string =
			'raw: 0x' + bufferToHexStr(data, 0, 4) + '<br/>'

		// Update the value displayed.
		displayValue('BarometerData', string)

		// Calculated values not implemented yet.
	}

	function gyroscopeHandler(data)
	{
		// Calculate the gyroscope values from raw sensor data.
		var values = sensortag.getGyroscopeValues(data)
		var x = values.x
		var y = values.y
		var z = values.z

		// Prepare the information to display.
		string =
			'raw: 0x' + bufferToHexStr(data, 0, 6) + '<br/>'
			+ 'x = ' + (x >= 0 ? '+' : '') + x.toFixed(5) + '<br/>'
			+ 'y = ' + (y >= 0 ? '+' : '') + y.toFixed(5) + '<br/>'
			+ 'z = ' + (z >= 0 ? '+' : '') + z.toFixed(5) + '<br/>'

		// Update the value displayed.
		displayValue('GyroscopeData', string)
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
		return hex
	}

	document.addEventListener('deviceready', initialiseSensorTag, false)
	