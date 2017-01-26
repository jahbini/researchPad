# # stagapp devices
# vim: et:ts=2:sw=2:sts=2:tw=0
# ### device interface handler for clinical recording of SensorTag data
# ### via TI SensorTag object.

Backbone = require('backbone')
_ = require('underscore')
require('./lib/console')
$ = require('jquery')
{EventModel} = require './models/event-model.coffee'
glib = require('./lib/glib.coffee').glib
Case = require 'Case'

# ## Sensor Data
# ### a single sensor reading
reading = Backbone.Model.extend
  defaults:
    sensor: 'gyro'
  initialize: ->
    d = new Date
    @set 'time', d.getTime()
# ### sensor readings are grouped into ten-second chunks, other events just have text

deviceModel = Backbone.Model.extend
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  idAttribute: "UUID"
  defaults:
    UUID: "00000000-0000-0000-0000-000000000000"
  initialize: ()->
      @.set 'nickname', glib(@.get 'UUID' )

deviceCollection = Backbone.Collection.extend
  model: deviceModel
Pylon.set 'devices', new deviceCollection

# View logic to watch and update the "start scanning" button and enable BLE device scan
pView=Backbone.View.extend
  el: '#scanDevices'
  model: Pylon.get 'devices'
  initialize: ->
    $('#StatusData').html 'Ready to connect'
    $('#FirmwareData').html '?'
    $('#scanActiveReport').html Pylon.get('pageGen').scanBody()
    Pylon.set 'scanActive', false
    @listenTo @model, 'add', (device)->
      # what we should lookf is not changes to pylon, but pylon's devices (a collection)
      # on devices add, create row #
      ordinal = @model.length
      device.set "rowName", "sensor-#{ordinal}"
      element = (Pylon.get 'pageGen').sensorView device
      return @
  events:
    "click": "changer"
  changer: ->
      console.log "Start Scan button activated"
      Pylon.set 'scanActive', true
      @render()
      setTimeout(
        ()=>
          Pylon.set 'scanActive', false
          @render()
          return
        ,30000)
      return
  render: ->
      if Pylon.get 'scanActive'
        @$el.prop "disabled",true
          .removeClass 'button-primary'
          .addClass 'button-success'
          .text 'Scanning'
      else
        @$el.prop("disabled",false)
          .removeClass 'button-success'
          .addClass 'button-primary'
          .text 'Scan Devices'
      return

Pylon.set 'tagViewer', new pView

Pipeline = require('./pipeline.coffee')

class TiHandler
  evothings = window.evothings
  sensorScanner = evothings.tisensortag.createGenericInstance()
  evothings.tisensortag.ble.addInstanceMethods(sensorScanner) #Add generic BLE instance methods.

# status callbacks for the BLE scan for devices mode -- should activate "status" view
  sensorScanner.statusCallback (s)->
    return if s == 'SCANNING'
    console.log "Scan status = "+s
    s = "Scan Complete" if s == "SENSORTAG_NOT_FOUND"
    $('#StatusData').css("color", "green").html s
    Pylon.trigger 'sensorScanStatus', s
    return
  sensorScanner.errorCallback (e)->
    # Evothings reports SCAN_FAILED when it detects a tag.  Not cool
    return if e == "SCAN_FAILED"
    console.log "Scan Error = "+e
    $('#StatusData').css("color", "red").html e
    Pylon.trigger 'sensorScanStatus', e
    return

  # send a GET request to the server to sync up this tag
  queryHostDevice = (d)->
    d.fetch
      success: (model,response,options) ->
        name = (d.get 'assignedName' ) || 'no Name'
        console.log "DEVICE FETCH from Host: #{name}"

      error: (model,response,options)->
        console.log (Pylon.get('hostUrl')+'/sensorTag')
        console.log "sensorTag fetch error: #{response.statusText}"

  Pylon.on "scanActive change",  =>
    if Pylon.get('scanActive')
      sensorScanner.startScanningForDevices (device)->
        return unless sensorScanner.deviceIsSensorTag device
        pd =Pylon.get('devices')
        uuid = device.address
        rssi = device.rssi
        if d=pd.findWhere(origUUID: uuid)

          d.set 'signalStrength', rssi
          return

        console.log "got new device"
        d = new deviceModel
          signalStrength: rssi
          genericName: device.name
          UUID: uuid
          origUUID: uuid
          rawDevice: device
          buttonText: 'connect'
          buttonClass: 'button-primary'
          deviceStatus: '--'
        pd.push d
        queryHostDevice(d)

        Pylon.trigger('change respondingDevices')
        return
    else
      sensorScanner.stopScanningForDevices()
      return

  Pylon.on "enableRight", (cid)->
    Pylon.get 'TiHandler'
      .attachDevice cid, 'Right'

  Pylon.on "enableLeft", (cid)->
    Pylon.get 'TiHandler'
      .attachDevice cid, 'Left'
  Pylon.on "enableDevice", (cid)->
    Pylon.get 'TiHandler'
      .attachDevice cid, 'Guess'
    


  constructor: (@sessionInfo) ->

  createVisualChain: (device) ->
    smoother = new Pipeline
    accelerometerHandler = smoother.readingHandler
      device: device
      sensor: 'accel'
      debias: 'calibrateAccel'
      source: (data)->
        (device.get 'getAccelerometerValues') data
      units: 'G'
      calibrator: [
        smoother.calibratorSmooth
      ]
      viewer: smoother.viewSensor "accel-#{device.get 'rowName'}",1.5
      finalScale: 1

    magnetometerHandler = smoother.readingHandler
      device: device
      sensor: 'mag'
      debias: 'calibrateMag'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getMagnetometerValues') data
      units: '&micro;T'
      viewer: smoother.viewSensor "mag-#{device.get 'rowName'}", 0.05/2
      finalScale: 1

    gyroscopeHandler = smoother.readingHandler
      device: device
      sensor: 'gyro'
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getGyroscopeValues') data
      viewer: smoother.viewSensor "gyro-#{device.get 'rowName'}", 0.05/2
      finalScale: 1

    return gyro: gyroscopeHandler
      , accel: accelerometerHandler
      , mag: magnetometerHandler

# #attachDevice
# when scan is active or completed, the devices can be enabled with only its UUID
# Enables the responding device UUID to send motion information
  attachDevice: (cid,role="Right") ->
    # reject attachDevice request if we are already recording
    gs = Pylon.get('globalState')
    return if gs.get 'recording'
    console.log "attach "+cid
    d = Pylon.get('devices').get cid
    # reject attachDevice if it connected Github issue #73
    return if d.get 'connected'
    d.set 'buttonText', 'connecting'
    d.set 'role',role
    d.set 'connected', false

    # triggers change:Right or change:Left
    Pylon.set role, d
    Pylon.trigger('change respondingDevices')
    console.log "Role of Device set, attempt connect"

    askForData= (sensorInstance,delay)->
      sensorInstance.accelerometerCallback (data)=>
          sensorInstance.handlers.accel data
        ,delay  # allow 10 ms response for 100 samples/second
      sensorInstance.magnetometerCallback (data)=>
          sensorInstance.handlers.mag data
        ,delay
      sensorInstance.gyroscopeCallback (data)=>
          sensorInstance.handlers.gyro data
        ,delay
        ,7

    try
      if d.get( 'genericName').search(/BLE/) > -1
        d.set 'type', evothings.tisensortag.CC2541_BLUETOOTH_SMART
      else
        d.set 'type', evothings.tisensortag.CC2650_BLUETOOTH_SMART
      sensorInstance = evothings.tisensortag.createInstance d.get('type')
      rawDevice = d.get 'rawDevice'
      rawDevice.sensorInstance= sensorInstance
      d.set sensorInstance: sensorInstance

      console.log "Device instance attributes set, attempt connect"

      # status handler is set -- d.get('sensorInstance').statusCallback (s)-> {something}
      sensorInstance.statusCallback (s)->
        console.log "StatusCallback -#{s}"
        if s == "CONNECTING"
          queryHostDevice d
          return
        if s == "CONNECTED"
          return
        if s == "READING_DEVICE_INFO"
          return
        if s == "READING_SERVICES"
          return
        statusList = evothings.tisensortag.ble.status
        if statusList.DEVICE_INFO_AVAILABLE == s
          d.set fwRev: sensorInstance.getFirmwareString()
          return

        if statusList.SENSORTAG_ONLINE == s
          sessionInfo = Pylon.get 'sessionInfo'
          sessionInfo.set role+'sensorUUID', d.id
          # add FWLevel to session data per Github issue stagapp 99
          sessionInfo.set "FWLevel#{if role=="Left" then 'L' else 'R'}", d.fwRev
          #why is there no comment on this next line?  Is that what you want to do??
          Pylon.trigger 'connected' unless d.get 'connected'
          d.set {
            connected: true
            buttonText: 'on-line'
            buttonClass: 'button-success'
            deviceStatus: 'Listening'
          }
          newID = sensorInstance.softwareVersion
          if sensorInstance.serialNumber &&  newID != "N.A."  # do we have a new tag
            switch  newRole = sensorInstance.serialNumber.slice -3
              when "(R)","B01"
                role="Right"
                #hacks!
                $("#RightSerialNumber").html sensorInstance.serialNumber
                $("#RightVersion").html sensorInstance.softwareVersion
              when "(L)","B02"
                role="Left"
                #hacks!
                $("#LeftSerialNumber").html sensorInstance.serialNumber
                $("#LeftVersion").html sensorInstance.softwareVersion
            
            d.set 'role',role
            Pylon.set role, d
            newID = Case.kebab "#{newID} #{sensorInstance.serialNumber}"
            d.set 'readings', new EventModel role, d
            Pylon.trigger('change respondingDevices')
            
            sessionInfo.set role+'sensorUUID', newID
            d.set 'firmwareVersion', sensorInstance.serialNumber
            if role == "Left"
              sessionInfo.set 'SerialNoL', sensorInstance.serialNumber
              sessionInfo.set 'FWLevelL', sensorInstance.getFirmwareString()
            else
              sessionInfo.set 'SerialNoR', sensorInstance.serialNumber
              sessionInfo.set 'FWLevelR', sensorInstance.getFirmwareString()

            d.set UUID: newID
            queryHostDevice d
            # raise sample data rate to 20ms per sample
            askForData sensorInstance, 20
          else
            #start off with data rate of 100ms per sample
            askForData sensorInstance, 100
            $('#'+role+'Nick').text d.get("nickname")
            $('#'+role+'uuid').text (d.get('assignedName') || d.id)
          Pylon.trigger('change respondingDevices')
        return

      # error  handler is set -- d.get('sensorInstance').errorCallback (e)-> {something}
      sensorInstance.errorCallback (s)->
        console.log "sensor ERROR report: " +s, ' '+d.id
        # evothings status reporting errors often report null, for no reason?
        return if !s
        err=s.split(' ')
        if evothings.easyble.error.CHARACTERISTIC_NOT_FOUND == err[0]
          return
        if evothings.easyble.error.DISCONNECTED == s || s == "No Response"
          d.set 'buttonClass', 'button-warning'
          d.set 'buttonText', 'reconnect'
          d.set 'deviceStatus', 'Disconnected'
          d.unset 'role'
        Pylon.trigger('change respondingDevices')
        return

      console.log "Setting Time-out now",Date.now()
      setTimeout ()->
          return if 'Receiving' == d.get 'deviceStatus'
          console.log "Device connection 10 second time-out "
          sensorInstance.callErrorCallback "No Response"
          sensorInstance.disconnectDevice()
        ,10000

      # bring the evothings data converters up to this device
      d.set 'getMagnetometerValues', sensorInstance.getMagnetometerValues
      d.set 'getAccelerometerValues', sensorInstance.getAccelerometerValues
      d.set 'getGyroscopeValues', sensorInstance.getGyroscopeValues

      console.log "evothings sensor callbacks registered, attempt connect"
      # and plug our data handlers into the evothings scheme
      sensorInstance.handlers= @createVisualChain d
      sensorInstance.connectToDevice d.get('rawDevice')
      if d.get 'type' == evothings.tisensortag.CC2650_BLUETOOTH_SMART
        sensorInstance.handlers.accel.finalScale = 2
        sensorInstance.handlers.mag.finalScale = 0.15
      askForData sensorInstance, 10

    catch e
      alert('Error in attachSensor -- check LOG')
      console.log "error in attachSensor"
      console.log e
    return d


if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
