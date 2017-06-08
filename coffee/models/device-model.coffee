Backbone = require 'Backbone'
{EventModel} = require './event-model.coffee'

buglog = require '../lib/buglog.coffee'
devicelogger = (devicelog= new buglog "sensor").log
Sanity = require '../lib/sanity.coffee'


infoService =       "0000180a-0000-1000-8000-00805f9b34fb"
infoService =       "180a"


boilerplate =
		firmwareVersion:    "2a26"
		modelNumber:        "2a24"
		serialNumber:       "2a25"
		softwareVersion:    "2a28"
accelerometer = 
    service:        "F000AA80-0451-4000-B000-000000000000"
    data:           "F000AA81-0451-4000-B000-000000000000" # read/notify 3 bytes X : Y : Z
    notification:   "F0002902-0451-4000-B000-000000000000"
    configuration:  "F000AA82-0451-4000-B000-000000000000" # read/write 1 byte
    period:         "F000AA83-0451-4000-B000-000000000000" # read/write 1 byte Period = [Input*10]ms

accelerometer.notification =  '00002902-0000-1000-8000-00805f9b34fb'  
accelerometer.notification =  '2902'  
accelerometer.period =   'F000AA83-0451-4000-B000-000000000000'

ab2str = (buf)->
   return String.fromCharCode.apply null, new Uint8Array buf

lastDisplay = 0

str2ab = (str)->
  buf = new ArrayBuffer(str.length*2); # 2 bytes for each char
  bufView = new Uint16Array(buf)
  bufView[i] = str.charCodeAt(i) for i in str
      
  return buf
  
exports.deviceModel = Backbone.Model.extend
  defaults:
    buttonText: 'connect'
    buttonClass: 'button-primary'
    deviceStatus: '--'
    rate: 20
    notify: true
    lastDisplay: Date.now()
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  #idAttribute: "name"
  initialize: ->
    role=@get 'role'
    @set 'readings', new EventModel role,@ 
    @set 'rowName', "sensor-#{role}"
    @sanity = new Sanity role
    try
      $("##{role}AssignedName").text @get 'name'
    catch error
      devicelogger "fail to find DOM element for #{role}AssignedName"   
    @on "change:role", ()->
      role=@get 'role'
      @set 'readings', new EventModel role,@ 
      @set 'rowName', "sensor-#{role}"
      $("##{role}AssignedName").text @get 'name'
      return
    Pylon.on "systemEvent:action:record", ()=>
      @sanity.clear()
      @set 'numReadings',0
      return
    Pylon.state.on "change:calibrating", ()=>
      @sanity.clear()
      @set notify: Pylon.state.get 'calibrating'
      return
    Pylon.state.on "change:sensorsOn", ()=>
      if Pylon.get 'sensorsOn'
        @sanity.clear()
        @resubscribe()
      else
        @stopNotification()
      return
    @on "change:serialNumber", ()->
      data = @.get 'serialNumber'
      role = @.get 'role'
      $("##{role}SerialNumber").html @.get 'serialNumber'
      #place serial number in sessionInfo
      session = Pylon.get 'sessionInfo'
      if role == 'Right'
        session.set 'SerialNoR', data
      if role == 'Left'
        session.set 'SerialNoL', data
      return
    @on "change:firmwareVersion",()->
      data = @.get 'firmwareVersion'
      role = @.get 'role'
      $("##{role}Version").html data
      #place firmware app level in sessionInfo
      session = Pylon.get 'sessionInfo'
      if role == 'Right'
        session.set 'FWLevelR', data
      if role == 'Left'
        session.set 'FWLevelL', data
      return


    return @
    
  getBoilerplate: ()->
    plates = []
    promises = for attribute, uuid of boilerplate
      devicelogger "Device #{@.attributes.name}: getting #{attribute} at #{uuid}"
      plates.push new Promise (resolve,reject)=>
        # capture current value of attribute
        attr = attribute
        ble.read @.id,
          infoService
          uuid
          (data)=>
            val = ab2str data
            devicelogger "Setting attribute for #{attr} to #{val}"
            @.set attr, val
            resolve()
          (err)=>
            devicelogger "unable to obtain #{attr} from #{@.attributes.name}"
            reject()
        devicelogger "Promised attribute for #{attr}"
    return plates
    
  startNotification: ()->
      devicelogger "startNotification entry"
      
      new Promise (resolve,reject)=>
        ble.withPromises.startNotification @.id,
          accelerometer.service
          accelerometer.data
          # convert raw iOS data into js and update the device model
          (data)=>
            @processMovement new Int16Array(data)
          (xxx)=>
            devicelogger "startNotification failure for device #{@.name}: #{xxx}"
            reject()
    
  stopNotification: ()->
    devicelogger "stopNotification entry"
    configData = new Uint16Array 1
      #Turn off gyro, accel, and mag, 2G range, Disable wake on motion
    configData[0] = 0x0000;
    ble.withPromises.stopNotification @.id,
        accelerometer.service
        accelerometer.data
        (whatnot)=> 
          devicelogger "stopNotification Terminated movement monitor. device #{@.name}"
          resolve()
        (e)=>
          devicelogger "stopNotification error terminating movement device #{@.name} monitor #{e}"
          reject()
          
  idlePromise: ()->
    return new Promise (resolve,reject)->
      devicelogger "idlePromise entry"
      setTimeout resolve,100
    
  setPeriod: ()->
    devicelogger "setPeriod entry"
    return new Promise (resolve,reject)=>
      periodData = new Uint8Array(1);
      periodData[0] = @.attributes.rate;
      devicelogger "Timing parameter for sensor rate = #{@.attributes.rate}"
      ble.write @.attributes.id,
        accelerometer.service
        accelerometer.period
        periodData.buffer
        ()=>
          devicelogger "setPeriod Configured movement #{10*@.attributes.rate}ms period device #{@.attributes.name}."
          resolve()
        (e)=>
          devicelogger "setPeriod error starting movement monitor #{e}"
          reject()
    
  activateMovement: ()->    
    devicelogger "activateMovement entry. device #{@.name}"
    configData = new Uint16Array(1);
    configData[0] = 0x017F;
    # turn accelerometer on
    #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
    return ble.withPromises.write @attributes.id,
        accelerometer.service
        accelerometer.configuration
        configData.buffer
        (whatnot)=> 
          devicelogger "activateMovement Started movement monitor. device #{@.name}"
          resolve()
        (e)=>
          devicelogger "activateMovement error starting movement device #{@.name} monitor #{e}"
          reject()
          
  resubscribe: ()=>
    try
    #set some attributes
      devicelogger "Device resubscribe attempt #{@.name}"
  # turn accelerometer off, then set movement  parameters
      thePromise = new Promise (res,rej)->res()
      resulting = resulting.then(@activateMovement.bind @)
      resulting = resulting.then(@idlePromise.bind @)
      resulting = resulting.then(@setPeriod.bind @)
      resulting = resulting.then(@idlePromise.bind @)
      resulting = resulting.then(@startNotification.bind @)
      devicelogger "resubscribe promise has been built"
      devicelogger resulting
        
    catch e
      Pylon.trigger "systemEvent:sanity:fail", @get 'role'
      devicelogger "error in resubscribe"
      devicelogger e
      device.set deviceStatus: 'Failed re-subscribe'
    return 
   
          
  subscribe: ()-> return (device)=>
    try
    #set some attributes
      devicelogger "Device subscribe attempt #{device.name}"
  # turn accelerometer off, then set movement  parameters
      thePromise = Promise.all @getBoilerplate()
      resulting = thePromise.then(@idlePromise.bind @)
      resulting = resulting.then(@activateMovement.bind @)
      resulting = resulting.then(@idlePromise.bind @)
      resulting = resulting.then(@setPeriod.bind @)
      resulting = resulting.then(@idlePromise.bind @)
      resulting = resulting.then(@startNotification.bind @)
      devicelogger "the promise has been built"
      devicelogger resulting
        
    catch e
      Pylon.trigger "systemEvent:sanity:fail", @get 'role'
      devicelogger "error in subscribe"
      devicelogger e
      device.set deviceStatus: 'Failed connection'
    return 
   
  sensorMpu9250GyroConvert: (data)->
      return data/(65536/500)

  sensorMpu9250AccConvert: (data)->
      #// Change  /2 to match accel range...i.e. 16 g would be /16
      return data/(32768/16)

  #//0 gyro x //1 gyro y //2 gyro z
  #//3 accel x //4 accel y //5 accel z
  #//6 mag x //7 mag y //8 mag z
  processMovement: (data)->
    timeval = Date.now()
    recording = Pylon.state.get 'recording'
    if recording || @get 'notify'
      @attributes.numReadings += 1
    if recording
      @attributes.readings.addSample data
    
    gyro= data[0..2].map @sensorMpu9250GyroConvert 
    accel= data[3..5].map @sensorMpu9250AccConvert
    mag= data[6..8].map (a)-> return a
    sequence = data[9]
    
    @sanity.observe gyro, accel, mag, sequence, timeval
    #only do sanity checks once per second
    if @lastDisplay + 1000 > Date.now()
          return
    @lastDisplay = Date.now()
    @set deviceStatus: 'Receiving'
    setTimeout @sanity.judge,0
    return
    # update the device attributes and fire changes for deviceStatus
    @chain.gyro gyro
    @chain.accel accel
    @chain.mag mag
    return

deviceCollection = Backbone.Collection.extend
  model: exports.deviceModel
Pylon.set 'devices', new deviceCollection
