CoffeeTemplates = require('coffee-templates')

engine = new CoffeeTemplates format: false, autoescape: false # defaults

templates =
  logo: ->
    div '#capture-display.container', ->
      div '.row', ->
        img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
        div '#dud.one.columns', '&nbsp;'
        h2 '.five.columns', 'Movement data capture'

  firstpage: ->
    console.log @args...
    div '.row', ->
      button '#record.three.columns button-primary', 'Record'
      button '#stop.three.columns', 'Stop'
      button '#upload.three.columns', 'Upload'
      button '#reset.three.columns', 'Reset'
    div '.row.keys', ->
      p '.three.columns', ->
        text 'SensorTag Status:'
        span '#StatusData', 'Not ready to connect'
      p '.three.columns', ->
        text 'SensorTag firmware version:'
        span '#FirmwareData', '?'
      p '.three.columns', ->
        text 'readings captured:'
        span '#TotalReadings', '0'
      p '.two.columns', ->
        text 'Keypress:'
        span '#KeypressData', '[Waiting for value]'
    div '.row.gyroscope', ->
      div '.four.columns', ->
        canvas '#gyro-view', width: '200', height: '200', style: 'width=100%'
      div '#GyroscopeData.five.columns dump',
      button '#calibrateGyro.suppress.three columns', 'Debias'
    div '.row.acelleration', ->
      div '.four.columns', ->
        canvas '#accel-view', width: '200', height: '200', style: 'width=100%'
      div '#AccelerometerData.five.columns dump',
      button '#calibrateAccel.suppress.three columns', 'Debias'
    div '.row.magnetometer', ->
      div '.four.columns', ->
        canvas '#magnet-view', width: '200', height: '200', style: 'width=100%'
      div '#MagnetometerData.five.columns dump',
      button '#calibrateMag.suppress.three columns', 'Debias'
    div '#console-log.container', ->
      h2 'Console'


module.exports = templates
