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
      displayValue('KeypressData', "");
      displayValue('AccelerometerData', blank);
      displayValue('MagnetometerData', blank);
      displayValue('GyroscopeData', blank);
      displayValue('TotalReadings',0);
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
  
  function initDataStructures(){
     
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
        displayValue('TotalReadings',0);
  }
    function initAll(){
     var rtemp; 
     clearUserInterface();
     initDataStructures();
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
  // sensortag.disconnectDevice();
  //sensortag = evothings.tisensortag.createInstance();
  recording=false;
 initDataStructures();
 enterConnected();
}

function enterConnected(){
  // enable the recording button
  connected = true;
  $("#record").prop('disabled',false).fadeTo(100,1).text('record').click(enterRecording);
  $("#stop").prop('disabled',true);
  $("#upload").prop('disabled',true);
}

function enterRecording(){
  $("#record").prop('disabled',true).text('recording').fadeTo(200,0.6);
  $("#stop").prop('disabled',false).fadeTo(100,1).click(enterReview);
  $("#upload").prop('disabled',true);
  recording=true;
}

function enterReview(){
  $("#stop").prop('disabled',true).fadeTo(100,0.5);
  $("#record").prop('disabled',true).text('recorded').fadeTo(200,0.3);
  $("#upload").prop('disabled',false).click(enterUpload).fadeTo(100,1)
 recording=false;	
}

function enterUpload(){
  var hopper,brainDump;
  /* eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15 */
  if(!readings.length) return;
  hopper = Backbone.Model.extend({url:"/trajectory"});
  brainDump = new hopper({readings: readings});
  brainDump.save();
  readings.reset();
  enterConnected();
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
    var left=0,right=0,string;
    // Do NOT Update background color.
    switch (data[0])
    {
      case 0:
        string = "          ";
        break;
      case 1:
        right=1;
        string = "     right";
        break;
      case 2:
        left=1;
        string = "left      ";
        break;
      case 3:
        right=1;
        left=1;
        string = "   both   ";
        break;
    }
        if(recording) readings.push( new reading({sensor:'button',left:left,right:right}));

    // Update the value displayed.
    // var string = 'raw: 0x' + bufferToHexStr(data, 0, 1);
    displayValue('KeypressData', string);
  }
  
  function templater(x,y,z,sensor,unit){
      return  sensor+ ' x=' + (x >= 0 ? '+' : '') + x.toFixed(3) + unit +' -- '
      + 'y=' + (y >= 0 ? '+' : '') + y.toFixed(3) + unit + ' -- '
      + 'z=' + (z >= 0 ? '+' : '') + z.toFixed(3) + unit;
  }
  
  function pointFormat(p,unit,precision){
      if(!precision) precision = 3;
      if(!unit) unit = 'v';
      return  ' x=' + (p.x >= 0 ? '+' : '') + p.x.toFixed(precision) + unit +' -- '
      + 'y=' + (p.y >= 0 ? '+' : '') + p.y.toFixed(precision) + unit + ' -- '
      + 'z=' + (p.z >= 0 ? '+' : '') + p.z.toFixed(precision) + unit;
  }

  function accelerometerHandler(data)
  {
    // Calculate the x,y,z accelerometer values from raw data.
    var values = sensortag.getAccelerometerValues(data);
    var x = values.x;
    var y = values.y;
    var z = values.z;
    if(recording) readings.push( new reading({sensor:'accel',x:x,y:y,z:z,raw:_.toArray(data)}));
    // Update the value displayed.
    displayValue('AccelerometerData', templater(x,y,z,'accel','G') );
    viewAccel(x,y,z);
  }

  function magnetometerHandler(data)
  {
    // Calculate the magnetometer values from raw sensor data.
    var values = sensortag.getMagnetometerValues(data)
    var x = values.x
    var y = values.y
    var z = values.z
    if(recording) readings.push( new reading({sensor:'mag',x:x,y:y,z:z,raw:_.toArray(data)}));

    // Update the value displayed.
    displayValue('MagnetometerData', templater(x,y,z,'mag','&micro;T'))
    viewMagnet(x,y,z);
  }

  function gyroscopeHandler(data)
  {
    // Calculate the gyroscope values from raw sensor data.
    var values = sensortag.getGyroscopeValues(data);
    var x = values.x;
    var y = values.y;
    var z = values.z;
    if(recording) readings.push( new reading({x:x,y:y,z:z,raw:_.toArray(data)})) ;

    // Update the value displayed.
    displayValue('GyroscopeData', templater(x,y,z,'gyro',''));
    viewGyro(x,y,z);
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

function viewSensor(viewport,scaleFactor){
  var height = 200, width = 200,
    model = seen.Models["default"](),
    scene = new seen.Scene({ model: model, viewport: seen.Viewports.center(width, height) }),
    context = seen.Context(viewport, scene),
    cubie = seen.Shapes.cube().scale(0.25),
    spearFromPool = new spearPool(10);
    
    cubie.fill( new seen.Material (new seen.Color(25,200,200,100)));
    model.add(cubie);
  
  function spearPool(many){
    var i,j,shapes = new Array(many),count=-1,colors=new Array(many);
    for (i=0; i< many;i++) {
      shapes[i] = seen.Shapes.arrow(1,18,0.5,2,1).scale(-1,1,1).translate(20,0,0).scale(height * 0.025);
      shapes[i].bake();
      colors[i] = new seen.Material (new seen.Color(255,80,255,255-(250/many)*i));
    }
    
    function newArrow(model,x,y,z){
      var alphaDecay=255;
      count = count+1;
      if(count == many) count=0;
      
      if (shapes[count]) model.remove(shapes[count]);
      shapes[count] = seen.Shapes.arrow(1,18,0.5,2,1).scale(-1,1,1).translate(20,0,0).scale(height * 0.025),
      model.add(shapes[count]);
      shapes[count].bake(); 
      shapes[count].reset();
      // assign alpha to the arrows color
      j=0; 
      for (i= count; i<many;i++){
        if(shapes[i])
          shapes[i].fill( colors[j++]);
      }
      for (i= 0; i<count;i++){
        if(shapes[i])
          shapes[i].fill( colors[j++]);
      }
      return shapes[count]; 
    }
   return newArrow; 
  }
  
function getSine(p1,p2){
  var pNew = p1.copy(),m1=p1.magnitude(),m2=p2.magnitude(),sinval;
  if(m1*m2 === 0) return 0;
  sinval = pNew.cross(p2).magnitude()/( m1*m2);
  sinval = Math.asin(sinval);
  return sinval;
}
  
  function newValue(x,y,z){
    var p1=seen.P(x,y,z),spear,pOriginal = p1.copy(),pBar=seen.P(1,0,0),m,q,
     cross,dot,
    leng = p1.magnitude();
    p1=p1.normalize();
    
    pBar.add(p1);
    
    if (pBar.magnitude() < 0.000001) {
      /* this is a 180 degree rotation, so use y axis as rotation vector */
      pBar=seen.P(0,1,0);  
    }
    
    pBar.normalize();
    q=seen.Quaternion.pointAngle(pBar,Math.PI);
    
    m=q.toMatrix();
    spear = spearFromPool(model,x,y,z).transform(m).scale(scaleFactor);
    spear.fill( new seen.Material (new seen.Color(255,80,255)));
    context.render();
  }
  return newValue;
}
var viewGyro = viewSensor('gyro-view',1);
var viewAccel = viewSensor('accel-view',0.8);
var viewMagnet = viewSensor('magnet-view',1);

/*
viewGyro(0,10,0);
viewGyro(0,-5,0);
viewGyro(0,0,10);
viewGyro(0,0,-5);
viewGyro(5,5,5);
viewGyro(0,5,5);
viewGyro(5,0,5);
viewGyro(5,5,0);
viewAccel(-0.5,0.6,0.7);
viewMagnet(0.5,0.6,-0.7);
viewMagnet(0.4,0.6,-0.8);
viewMagnet(0.3,0.6,-0.2);
viewGyro(10,0,0);
viewGyro(-5,0,0);
*/

$(function(){
  initAll();
  $("#reset").prop('disabled',false).fadeTo(0,1).click(enterReset);
  $(document).on('deviceready', initialiseSensorTag );
});	
