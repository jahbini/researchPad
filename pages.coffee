{render,renderable,raw,div,img,h2,h3,button,p,text,span,canvas,option,select,form,body,head,doctype,hr} = require('teacup')

logo = renderable ()->
   div '.row', ->
      img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
      div '#dud.one.columns', ->
        raw '&nbsp;'
      h3 '.five.columns', 'Movement data capture'

firstpage = render ->
  div '#capture-display.container', ->
    logo ->
    div '.row', ->
      button '#record.three.columns button-primary', 'Record'
      button '#stop.three.columns', 'Stop'
      button '#upload.three.columns', 'Upload'
      button '#reset.three.columns', 'Reset'
    div '.row', ->
      button '.three.columns.disabled', ''
      button '.three.columns.disabled', ''
      button '.three.columns.disabled', ''
      button '.three.columns.disabled', ''
    hr()
    div '.row.readings', ->
      div '.row.gyroscope.four.columns', ->
        h3 'Gyroscope'
        canvas '#gyro-view', width: '200', height: '200', style: 'width=100%'
        div '#GyroscopeData.five.columns dump',
        button '#calibrateGyro.suppress.three columns', 'Debias'
      div '.row.acelleration.four.columns', ->
        h3 'Accelerometer'
        canvas '#accel-view', width: '200', height: '200', style: 'width=100%'
        div '#AccelerometerData.five.columns dump',
        button '#calibrateAccel.suppress.three columns', 'Debias'
      div '.row.magnetometer.four.columns', ->
        h3 'Magnetometer'
        canvas '#magnet-view', width: '200', height: '200', style: 'width=100%'
        div '#MagnetometerData.five.columns dump',
        button '#calibrateMag.suppress.three columns', 'Debias'
    hr()
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

    hr()
    div '#console-log.container', ->
      h2 'Console'

loginForm = renderable (users,patients)->
  form '#login.row', ->
    label 'Clinition'
    select 'Clinician', ->
      option user for user in users
    label 'Client'
    select 'Patient', ->
      option patient for patient in patients

hostForm = renderable (hosts)->
  form '#remoteHost', ->
    select 'Host', ->
      host for host in Hosts


module.exports = {logo:logo,firstpage:firstpage}
