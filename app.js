// # stagapp
// ## data handler for clinical recording of SensorTag data
  // SensorTag object.
  // external requirements
  require('./libs/console.js');
  var console = new Console('console-log');
  var $=require('jquery');
  var _=require("./libs/dbg/underscore.js");
  var Backbone=require("./libs/dbg/backbone.js");
  var seen=require("./libs/dbg/seen.js");
  //  require("./libs/extras/coffee-script.js");
  require("./libs/evothings/easyble/easyble.js");
  require("./libs/evothings/tisensortag/tisensortag.js");
  require("./libs/evothings/util/util.js");
  
  var sensortag = evothings.tisensortag.createInstance();
  var recording = false,
   connected=false,
   reading,
   readings,
   calibrating=false,
   calibrate=false;
  try {
  $(document).on('deviceready', initialiseSensorTag );
  } catch (e){
    console.error(e);
  }
// ## Hardware
// external communications to Hardware
//
// set up the sensorTag and configure to recieve
// accelerometer, magnetometer and gyro data
//
  function initialiseSensorTag(){
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
    console.log('Enter Sensor Init');
    try {
    connected = false;
    sensortag
      .statusCallback(statusHandler)
      .errorCallback(errorHandler)
      .keypressCallback(keypressHandler)
      .accelerometerCallback(accelerometerHandler, 100)
      .magnetometerCallback(magnetometerHandler, 100)
      .gyroscopeCallback(gyroscopeHandler, 100, 7) // 7 = enable all axes.
      .connectToClosestDevice();
    } catch (e) {
      console.error(e);
    }
      console.log('Sensor Init');
  }
  
 // ## section: View
 // routines to control or coordinate with user
 //
  
  function templater(x,y,z,sensor,unit){
      if(!unit) unit = '';
      if(!sensor) sensor="raw";
      return  sensor+ ' x=' + (x >= 0 ? '+' : '') + x.toFixed(2) + unit +' -- '
      + 'y=' + (y >= 0 ? '+' : '') + y.toFixed(2) + unit + ' -- '
      + 'z=' + (z >= 0 ? '+' : '') + z.toFixed(2) + unit;
  }
  
  function pointFormat(p,unit,precision){
      if(!precision) precision = 2;
      if(!unit) unit = 'v';
      return  unit +' x=' + (p.x >= 0 ? '+' : '') + p.x.toFixed(precision) +' -- '
      + 'y=' + (p.y >= 0 ? '+' : '') + p.y.toFixed(precision) + ' -- '
      + 'z=' + (p.z >= 0 ? '+' : '') + p.z.toFixed(precision);
  }
 
  function clearUserInterface(){
    // Clear current values.
    var blank = '[Waiting for value]';
    $('#StatusData').html('Ready to connect');
    $('#FirmwareData').html('?');
    $('#KeypressData').html('');
    $('#AccelerometerData').html(blank);
    $('#MagnetometerData').html(blank);
    $('#GyroscopeData').html(blank);
    $('#TotalReadings').html( 0);
    // Reset screen color.
    setBackgroundColor('white');
    $(":button").prop("disabled",true);
    $("#stop").click(stopRecording);
    $("#record").click(enterRecording).fadeTo(0,1).text('record');
    $("#reset").prop("disabled",false);
      console.log('UI Init')
  }

  function countReadings(){
    $('#TotalReadings').html(readings.length);
  }
 
 // ## Section: Data Structures
 // Routines to create and handle data structures and interfaces to them
 //
  function initDataStructures(){
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
    console.log('Data Structures Init')
  }
  // ## Section State Handlers
  
  
  function initAll(){
    var rtemp; 
    clearUserInterface();
    initDataStructures();
    $('#TotalReadings').html( '0');
  }
 // ### subsection State handlers that depend on the View 
  function keypressHandler(data){
    var left=0,right=0,string;
    
    switch (data[0]){
      case 0:
        string = "          ";
        break;
      case 1:
        string = "     right";
        right=1;
        break;
      case 2:
        string = "left      ";
        left=1;
        break;
      case 3:
        right=1;
        left=1;
        string = "   both   ";
        break;
    }
    calibrate = (left && calibrating);
    if(recording) readings.push( new reading({sensor:'button',left:left,right:right}));

    // Update the value displayed.
    $('KeypressData').html(string);
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
    $('#TotalReadings').html( '0');
  }
  
  function enterConnected(){
    console.log('enterConnected begin');
    // enable the recording button
    connected = true;
    $("#record").prop('disabled',false).fadeTo(100,1).text('record').click(enterRecording);
    $("#stop").prop('disabled',true);
    $("#upload").prop('disabled',true);
    $("#calibrate").prop('disabled',false).click(enterCalibrating);
  }
  
  function enterCalibrating(){
    $("#record").prop('disabled',true);
    $("#stop").prop('disabled',true);
    $("#upload").prop('disabled',true);
    $("#calibrate").text("button 1 active").click(exitCalibrating);
    calibrating=true;
  }
  
  function exitCalibrating(){
    calibrating=false;
    $("#calibrate").text("calibrate").click(enterCalibrating);
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
//    eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15 */
    if(!readings.length) return;
    hopper = Backbone.Model.extend({url:"/trajectory"});
    brainDump = new hopper({readings: readings});
    brainDump.save();
    readings.reset();
    enterConnected();
  }
 //
 // ### Subsection State Handlers that depend on the Hardware
  function statusHandler(status){
    if ('Sensors online' == status){
      enterConnected();
    }
    
    if ('Device data available' == status){
      $('#FirmwareData').html(sensortag.getFirmwareString());
    }
    $('#StatusData').html(status);
  }
  
  function errorHandler(error){
    console.log('Error: ' + error)
    if ('disconnected' == error){
      connected = false;
      clearUserInterface();
      // If disconneted attempt to connect again.
      setTimeout(
        function() { sensortag.connectToClosestDevice() },
        1000)
    }
  }

// ## subsection State routines that depend on hardware and update the view or data structures
// calculations implemented as based on TI wiki pages
// http://processors.wiki.ti.com/index.php/SensorTag_User_Guide
 var accelerometerHandler = readingHandler(
   {sensor:'accel',
    debias:'calibrateAccel',
    source:sensortag.getAccelerometerValues,
    units:'G',
    calibrator:[calibratorAverage,calibratorSmooth],
    viewer:viewSensor('accel-view',0.4),
    htmlID:'AccelerometerData'}
    );
 var magnetometerHandler = readingHandler(
   { sensor:'mag',
    debias:'calibrateMag',
    calibrator:[calibratorAverage,calibratorSmooth],
     source:sensortag.getMagnetometerValues,
     units:'&micro;T',
     viewer:viewSensor('magnet-view',0.05),
     htmlID:'MagnetometerData'}
     );
 var gyroscopeHandler = readingHandler(
   {sensor:'gyro',
    debias:'calibrateGyro',
    calibrator:[calibratorAverage,calibratorSmooth],
    source:sensortag.getGyroscopeValues,
    viewer:viewSensor('gyro-view',0.005),
    htmlID:'GyroscopeData'
   }
   );
 
 function calibratorAverage(dataCondition,calibrate,calibrating){
   try{ 
     var tH;
     if(dataCondition.dataHistory.grandTotal === undefined){
       dataCondition.dataHistory.grandTotal = seen.P(0,0,0);
       dataCondition.dataHistory.grandAverage = seen.P(0,0,0);
       dataCondition.dataHistory.totalReadings = 1;
     }
     tH = dataCondition.dataHistory;
     if(tH.totalReadings === 1000){
       tH.grandTotal.subtract(tH.grandAverage);
       tH.totalReadings --;
     }
     tH.grandTotal.add(dataCondition.curValue);
     tH.totalReadings++;
     tH.grandAverage=tH.grandTotal.copy().divide(tH.totalReadings);
     dataCondition.cookedValue = dataCondition.curValue.copy().subtract(tH.grandAverage);
   } catch (e) {
     console.log(e.message);
   }
 }
 
  function split(raw,lo,hi){
    return raw-(hi+lo)/2.0;
  } 
 function calibratorMid(dataCondition,calibrate,calibrating){
   try{ 
     var tH;
     if(dataCondition.dataHistory.max === undefined){
       dataCondition.dataHistory.max = dataCondition.cookedValue.copy();
       dataCondition.dataHistory.min = dataCondition.cookedValue.copy();
     }
     tH = dataCondition.dataHistory;
     if(dataCondition.cookedValue.x>tH.max.x)tH.max.x = dataCondition.cookedValue.x;
     if(dataCondition.cookedValue.y>tH.max.y)tH.max.y = dataCondition.cookedValue.y;
     if(dataCondition.cookedValue.z>tH.max.z)tH.max.z = dataCondition.cookedValue.z;
     if(dataCondition.cookedValue.x<tH.min.x)tH.min.x = dataCondition.cookedValue.x;
     if(dataCondition.cookedValue.y<tH.min.y)tH.min.y = dataCondition.cookedValue.y;
     if(dataCondition.cookedValue.z<tH.min.z)tH.min.z = dataCondition.cookedValue.z;
     dataCondition.cookedValue.x = split(dataCondition.cookedValue.x,tH.min.x,tH.max.x);
     dataCondition.cookedValue.y = split(dataCondition.cookedValue.y,tH.min.y,tH.max.y);
     dataCondition.cookedValue.z = split(dataCondition.cookedValue.z,tH.min.z,tH.max.z);
   } catch (e) {
     console.log(e.message);
   }
 }
 
 function calibratorSmooth(dataCondition,calibrate,calibrating){
   try{ 
     if(dataCondition.dataHistory.runniongSum === undefined){
       dataCondition.dataHistory.runningSum = dataCondition.cookedValue.copy()
     };
     dataCondition.cookedValue = dataCondition.dataHistory.runningSum.multiply(0.75).
      add(dataCondition.cookedValue.copy().multiply(0.25)).copy();
   } catch (e) {
     console.log(e.message);
   }
 }
 
 //
 //#  ## readingHandler()
 //# create and return a function to handle a sensor's new data
  function readingHandler(o){
    var dataCondition = {
      curValue:seen.P(0,0,0),
      cookedValue:seen.P(0,0,0),
      dataHistory:{}
      };
    // if there is no calibration function, just use a null offset
    if(!o.calibrator) o.calibrator = function(d){d.cookedValue = d.curValue;};
    if(!o.units) o.units = '';
    o.bias = seen.P(0,0,0);
    $('#'+o.debias).click(function(){
      o.bias = o.cookedValue;
      console.log(o);
      });
    
    return function (data){
      // data points from Evothings library are seen.Point NOT compatible as sources
      var r=o.source(data),p,m; 
      // get the sensor data and pass to conditioner
      r=seen.P(r.x,r.y,r.z);
      r.subtract(o.bias);
      dataCondition.curValue = r.copy(); 
      dataCondition.cookedValue = r.copy(); 
      for (var i=0; i<o.calibrator.length; i++) o.calibrator[i](dataCondition,calibrate,calibrating);
      p=dataCondition.cookedValue;
      if(recording) readings.push(
        new reading({sensor:o.sensor,x:p.x,y:p.y,z:p.z,raw:_.toArray(data)})
        
        );
      m=dataCondition.dataHistory;
      $('#'+o.htmlID).html(templater(p.x,p.y,p.z,o.sensor,o.units)
      + "<br>" + templater(r.x,r.y,r.z,"raw")
      +((m.min)? "<br>" + pointFormat(m.min,"min") + "<br>" + pointFormat(m.max,"max"):"" )
      +((m.grandAverage)? "<br>" +pointFormat(m.grandAverage,"ave"):"" )
      + "<br>" + bufferToHexStr(data)
      );
      o.viewer(p.x,p.y,p.z);
    };
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
    var hex = '';
    if(!numBytes)numBytes=buffer.length;
    if(!offset) offset=0;
    for (var i = 0; i < numBytes; ++i)
    {
      hex += byteToHexStr(buffer[offset + i]) + " ";
    }
    return hex;
  }

  /**
   * Convert byte number to hex string.
   */
  var hx = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
  function byteToHexStr(d)
  {
    var lo =hx[d & 0xf];
    var hi =hx[(d&0xf0)>>4];
    return hi+lo;
  }
  
// ## stopRecording
// halt the record session -- no restart allowed
// upload button remains enabled, reset button remains enabled
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
    spear = spearFromPool(model,x,y,z).transform(m).scale(scaleFactor*leng);
    spear.fill( new seen.Material (new seen.Color(255,80,255)));
    context.render();
  }
  return newValue;
}

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

viewMagnet(10.5,0.6,-0.7);
viewMagnet(10.4,0.6,-0.8);
viewMagnet(10.4,2.6,-0.8);
viewMagnet(10.4,5.6,-0.8);
viewMagnet(10.3,0.6,-0.2);

viewGyro(10,0,0);
viewGyro(-5,0,0);
*/

$(function(){
  console.log('hello');
  initAll();
  $('.suppress').hide();
  $("#reset").prop('disabled',false).fadeTo(0,1).click(enterReset);
});	
