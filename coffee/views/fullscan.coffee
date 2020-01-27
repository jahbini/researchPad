# vim: et:ts=2:sw=2:sts=2:nowrap
# global Pylon
#

Backbone = require('backbone')
_ = require('underscore')
$=require('jquery')
T = require('teacup')
buglog = require '../lib/buglog.coffee'
enginelogger = (introlog= new buglog "fullscan").log

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference


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


fullscanBody = Backbone.View.extend
  el: "#protocol-here"
  clear: ()->
    enginelogger "fullscan clear"
    @$el.html('')
    return
  initialize: ()->
    Pylon.trigger "disconnectSensorTags"
    enginelogger "fullscan initialize"
    @$el.html T.render =>
      T.div ".container",style: "padding-top:25px;padding-bottom:25px", =>
        return

    return
###

advertising: Object
  kCBAdvDataIsConnectable: 1
  kCBAdvDataLocalName: "retrotope-mot(L)"
  kCBAdvDataManufacturerData: ArrayBuffer
  byteLength: 5
  ArrayBuffer Prototype
  kCBAdvDataServiceUUIDs: ["AA80"] (1)
  kCBAdvDataTxPowerLevel: 0

id: "98FD0808-E151-5717-4AB6-5FA3311EB728"
name: "SensorTag (l)"
rssi: -66
###
Device = Backbone.Model.extend()
Devices = Backbone.Collection.extend
  model: Device

Pylon.deviceLibrary = deviceLibrary = new Devices()
LibraryView = Backbone.View.extend
  el: "#deviceList"
  initialize: ()->
    @listenTo deviceLibrary,'update',@render,@
  render: ()->
    enginelogger "rendering deviceList"
    return unless @$el
    @$el.show()
    @$el.html T.render ()->
      T.div '.container', ()->
        deviceLibrary.each (node)->
          T.div '.row', ()->
            a=node.attributes
            return unless a.name?.match /etrotop-m|sensorta/i
            T.div '.two.columns',a.id[-4..]
            T.div '.four.columns',a.name
            T.div '.four.columns',a.advertising?.CBAdvDataLocalName if a.advertising
            T.button '.three.columns.button-primary',"#{Pylon.onWhat}":"Pylon.trigger('connectTag','#{a.id}')",'Reset' if a.name?.match /retroto|sensorta/i

fullscanExample = Backbone.View.extend
  el: "#example"
  response: (got,wanted)->
    enginelogger "fullscan example response"
    Pylon.trigger "systemEvent:fullscan:got-#{got}"
    return
  clear: ()->
    enginelogger "fullscan example clear"
    @$el.html('')
    return
  initialize: ()->
    @$el.html T.render =>
      T.div ".row",->
        T.div '.one.column'
        T.button "#disconnectButton.three.columns.button-primary","#{Pylon.onWhat}":"Pylon.trigger('disconnection')","STOP"
        T.div ".five.columns","Register sensorTag"
        T.button "#refreshButton.three.columns.button-primary","#{Pylon.onWhat}":"Pylon.trigger('refreshScan')","SCAN"
      T.div ".app.row",style:"font-size:2rem;text-align:center", ->
        T.div "#mainPage",->
          T.ul "#deviceList"
        T.div "#detailPage",->
          T.div "#accelerometerData","waiting"

    Pylon.on 'disconnection', () ->
      Pylon.trigger 'disconnecttag'
      Pylon.trigger "systemEvent:action:stop"
      return
    Pylon.on 'refreshScan',@refreshDeviceList,@
    Pylon.on 'connectTag',@connect,@
    enginelogger "fullscan example initialize"
    Pylon.viewLibrary = new LibraryView()
    @bindEvents()
    $("#detailPage").hide()
    return
  bindEvents: ->
    document.addEventListener 'deviceready', @onDeviceReady.bind(@) , false
    #$("#refreshButton").on 'touchstart', @refreshDeviceList.bind(@), false
    # assume not scrolling
    return
  onDeviceReady: ->
    @refreshDeviceList()
    return
  refreshDeviceList: ->
    Pylon.trigger "disconnectSensorTags"
    deviceLibrary.reset()
    # empties the list
    # scan for all devices
    ble.scan [], 10, @onDiscoverDevice.bind(@), @onError.bind()
    $("#detailPage").hide()
    return
  onDiscoverDevice: (unit) ->
    # we're not limiting scanning by services, so filter
    # the list for devices with "Sensor" in the name
    deviceLibrary.add unit
    return
  connect:  (e) ->
    deviceId = e
    Pylon.on 'disconnecttag' , () ->
      ble.disconnect deviceId, (-> return),( -> return)
      return

    onAccelerometerData= (data) ->
      message = undefined
      a = new Uint8Array(data)
      # TODO get a template to line this up
      # TODO round or format numbers for better display
      message = 'X: ' + a[0] / 64 + '<br/>' + 'Y: ' + a[1] / 64 + '<br/>' + 'Z: ' + a[2] / 64 * -1
      @$('#accelerometerData').html message
      enginelogger message
      return

    startOK = ()=>
      ble.startNotification deviceId, accelerometer.service, accelerometer.data, onAccelerometerData, @onError
      return
    onStart = ->
      configData = new Uint16Array(1);
      configData[0] = 0x017F;
      ble.write deviceId, accelerometer.service, accelerometer.configuration, configData.buffer, (=>startOK()), @onError

    onConnect = ->
      # subscribing for incoming data
      #ble.startNotification deviceId, accelerometer.service, accelerometer.data, onAccelerometerData, @onError
      # turn accelerometer on
      configData = new Uint8Array(1)
      configData[0] = 0xFF
      ble.write deviceId, accelerometer.service, accelerometer.period, configData.buffer, (=>
        enginelogger 'Started accelerometer.'
        onStart()
        return
      ), @onError
      $("#detailPage").show()
      $("#deviceList").hide()
      return

    ble.connect deviceId, onConnect, @onError.bind(@)
    return



  onError: (reason) ->
    enginelogger 'ERROR: ', reason
    # real apps should use notification.alert
    return

exports.fullscanBody = fullscanBody
exports.fullscanExample = fullscanExample
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
#
