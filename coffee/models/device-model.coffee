Backbone = require 'backbone'
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
    hasBoilerPlate: false
    buttonText: 'connect'
    buttonClass: 'button-primary'
    deviceStatus: '--'
    connected: false
    rate: 20
    subscribeState: false
    lastDisplay: Date.now()
    numReadings: 0
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  #idAttribute: "name"
  initialize: ->
    role= 'Guess'
    name = @get 'name'
    return if 0<name.search 'etrotope-mot'
    role= 'Left' if 0< name.search /\(([Ll]).*\)/
    role= 'Right' if 0< name.search /\(([Rr]).*\)/
    @.attributes.role = role
    Pylon.trigger "systemEvent:sanity:idle"+ role
    @set 'readings', new EventModel role,@ 
    @set 'rowName', "sensor-#{role}"
    #set this attribute without firing off any events
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
 
    Pylon.state.on "change:recording change:subscribing#{@get 'role'} change:calibrating", ()=>
      role=@get 'role'
      #any of the state values that are truthy will turn on the subscription
      devicelogger "BLE connection request for #{role}"
      for key, element of @.changedAttributes()
        devicelogger "#{key} is #{element} was #{@.previous key}"

      # legal values for recording state are 'recording' or 'stopping' or false
      recordingState =  !! Pylon.state.get 'recording'
      calibratingState =  !! Pylon.state.get 'calibrating'
      sideState = !! Pylon.state.get "subscribing#{@get 'role'}"

      #set the trigger -- the first packet recieved will signal connection
      @set 'numReadings',0 if recordingState and !@get 'connected'
      devicelogger 'numReadings now set as',@get 'numReadings'
      connectPlease = recordingState | calibratingState | sideState

      #if we are in the desired state already, just go away
      if connectPlease  == @.get 'subscribeState'
        devicelogger 'Change in connection request: no change in subscribe status'
        return
      
      @.set subscribeState: connectPlease
      devicelogger "state of device now",@
      if connectPlease
        devicelogger 'Change in connection request: (re) attachDevice'
        @sanity.clear()
        @.connectToDevice().then  @subscribe.bind @
      else
        devicelogger 'Change in connection request: detachDevice'
        @disconnect()
        #   @stopNotification()
      return
        
    @on "change:serialNumber", ()->
      data = @.get 'serialNumber'
      role = @.get 'role'
      $("##{role}SerialNumber").html @.get 'serialNumber'
      #place serial number in sessionInfo
      session = Pylon.sessionInfo
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
      session = Pylon.sessionInfo
      if role == 'Right'
        session.set 'FWLevelR', data
      if role == 'Left'
        session.set 'FWLevelL', data
      return
    return @
    
  getBoilerplate: ()->
    #fill in plates with a resolved request 
    plates = [ new Promise (resolve)-> resolve() ]
    if @get 'hasBoilerPlate'
      return plates
    for attribute, uuid of boilerplate
      plates.push new Promise (resolve,reject)=>
        # capture current value of attribute
        attr = attribute
        ble.read @.id,
          infoService
          uuid
          (data)=>
            val = ab2str data
            @.set attr, val
            resolve()
          (err)=>
            devicelogger "unable to obtain #{attr} from #{@.attributes.name}"
            reject()
        return
    return plates
    
  startNotification: ()->
      devicelogger "startNotification entry"
      @set 'numReadings',0
      
      #hold off the first sanity check to 1000 ms from now
      @lastDisplay = Date.now()
      new Promise (resolve,reject)=>
        ble.withPromises.startNotification @.id,
          accelerometer.service
          accelerometer.data
          # convert raw iOS data into js and update the device model
          (data)=>
            if @.attributes.numReadings == 0
              setTimeout (()-> resolve()), 0,@ 
            @processMovement new Int16Array(data)
          (err)=>
            devicelogger "startNotification failure for device #{@get 'name'}: #{err}"
            reject()
    
  stopNotification: ()->
    Pylon.trigger "systemEvent:sanity:idle"+ @get 'role'
    devicelogger "stopNotification entry"
    configData = new Uint16Array 1
      #Turn off gyro, accel, and mag, 2G range, Disable wake on motion
    configData[0] = 0x0000;
    ble.withPromises.stopNotification @.id,
        accelerometer.service
        accelerometer.data
        (whatnot)=> 
          devicelogger "stopNotification Terminated movement monitor. device #{@get 'name'}"
          resolve()
        (e)=>
          devicelogger "stopNotification error terminating movement device #{@get 'name'} monitor #{e}"
          reject()
          
  idlePromise: ()->
    return new Promise (resolve,reject)->
      setTimeout resolve,100
      return
    
  setPeriod: ()->
    return new Promise (resolve,reject)=>
      periodData = new Uint8Array(1);
      periodData[0] = @.attributes.rate;
      ble.write @.attributes.id,
        accelerometer.service
        accelerometer.period
        periodData.buffer
        ()=>
          resolve()
        (e)=>
          devicelogger "setPeriod error starting movement monitor #{e}"
          reject()
      return
    
  activateMovement: ()->    
    configData = new Uint16Array(1);
    configData[0] = 0x017F;
    # turn accelerometer on
    #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
    return ble.withPromises.write @attributes.id,
        accelerometer.service
        accelerometer.configuration
        configData.buffer
        (whatnot)=> 
          resolve()
        (e)=>
          devicelogger "activateMovement error starting movement device #{@get 'name'} monitor #{e}"
          reject()
          
  resubscribe: ()->
    devicelogger "RESUBSCRIBE"
    role = @get 'role'
    Pylon.trigger "systemEvent:sanity:warn"+ role
    try
    #set some attributes
      devicelogger "Device resubscribe attempt #{@.get 'name'}"
  # turn accelerometer off, then set movement  parameters
      thePromise = new Promise (res,rej)->res()
      resulting = thePromise.then(@activateMovement.bind @)
      resulting = resulting.then(@idlePromise.bind @)
      resulting = resulting.then(@setPeriod.bind @)
      resulting = resulting.then(@idlePromise.bind @)
      resulting = resulting.then(@startNotification.bind @)
      # No resulting.then clause -- device triggers active on first packet recieved 
      resulting.catch ()=>
        Pylon.trigger "systemEvent:sanity:fail"+ @get 'role'
        
    catch e
      Pylon.trigger "systemEvent:sanity:fail"+ @get 'role'
      devicelogger "error in resubscribe"
      devicelogger e
      device.set deviceStatus: 'Failed re-subscribe'
    return 
   
          
  subscribe: ()-> 
    Pylon.trigger "systemEvent:sanity:warn"+ @.attributes.role
    try
    #set some attributes
      devicelogger " subscribe attempt #{@.attributes.name}"
  # turn accelerometer off, then set movement  parameters
      thePromise = Promise.all @getBoilerplate()
      thePromise.then ()=>@set 'hasBoilerPlate',true  # do not get these values again
      thePromise.then @resubscribe.bind @
      thePromise.catch ()=>
        Pylon.trigger "systemEvent:sanity:fail"+ @get 'role'
        
    catch e
      Pylon.trigger "systemEvent:sanity:fail"+ @get 'role'
      devicelogger "error in subscribe"
      devicelogger e
      device.set deviceStatus: 'Failed connection'
    return 
  connectToDevice:()->
    return new Promise (resolve,reject)=>
      ble.connect (@.get "id"),
        resolve
        (e)=> 
          Pylon.trigger "systemEvent:sanity:fail"+ @.get 'role'
          @.set deviceStatus: 'Failed Connection', connected: false
          devicelogger "Failure to connect",e
          reject()
          
  disconnect:()->
    @.set deviceStatus: "Disconnecting"
    ble.disconnect (@.get "id"),
      ()=> 
        Pylon.trigger "systemEvent:sanity:idle"+ @.get 'role'
        @.set connected:false, deviceStatus: 'Available'
        devicelogger "disconnection of #{name}"
      (e)=> 
        Pylon.trigger "systemEvent:sanity:fail"+ d.get 'role'
        @.set connected: false, deviceStatus: 'Unknown', buttonText: 'connect'
        devicelogger "Failure to disconnect",e
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
    if @attributes.numReadings == 0
      @set deviceStatus: 'Receiving', connected: true
      Pylon.trigger 'systemEvent:sanity:active'+@get 'role'
      
    @attributes.numReadings += 1
    if recording
      @attributes.readings.addSample data
    
    gyro= data[0..2].map (a)->return a
    accel= data[3..5].map (a)->return a
    mag= data[6..8].map (a)-> return a
    sequence = data[9]
    Pylon.trigger "#{@get 'role'}Vertmeter",100*(accel[0]+2**15)/(2**16)
    
    @sanity.observe gyro, accel, mag, sequence, timeval
    #only do sanity checks once per second
    if @lastDisplay + 1000 > Date.now()
          return
    @lastDisplay = Date.now()
    setTimeout @sanity.judge,0
    return

deviceCollection = Backbone.Collection.extend
  model: exports.deviceModel
Pylon.set 'devices', new deviceCollection
