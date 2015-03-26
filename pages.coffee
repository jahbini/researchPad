# vim: et:ts=2:sw=2:sts=2
exports.Pages = class Pages
  Teacup = require('teacup')
  $=require('jquery')
  tea = new Teacup.Teacup
  {render,input,renderable,raw,div,img,h2,h3,h4,label,button,p,text,span,canvas,option,select,form,body,head,doctype,hr,br,password} = tea.tags()

  sessionInfo: {}

  admin: {}

  constructor: (@admin,session) ->
      Teacup.Teacup.prototype.admin = @admin
      Teacup.Teacup.prototype.Page = @
      @sessionInfo = session

  theBody: renderable (buttons,contents1,contents2)=>
    div '#capture-display.container', ->
      div '.row', ->
        img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
        div '#dud.one.columns', ->
          raw '&nbsp;'
        h3 '.five.columns', 'Movement data capture'
      buttons()
      contents1()
      hr()
      contents2()
      hr()
      div '#footer','style="display:none;"', ->
        div '#console-log.container', ->
          h2 'Console'

  adminContents: renderable ()->
     div '#adminForm', ->
      hr() 
      form ->
        div '.row', ->
          div '.two.columns', ->
            label 'Remote Host'
            select '#desiredHost.u-full-width', onchange: "" , 'Host', ->
              option "Select ---"
              for host in @admin.get('host').toArray()
                option value: host.get('url') , host.get('name')
          div '.four.columns', ->
            label for: 'clinician','Clinician'
            select '#clinician.u-full-width', ->
              option "Select ---"
              for user in @admin.get('user').toArray() when !user.get('patientOnly')
                option value: user.get('name'), user.get('name')
            br()
            label for: "password", "Enter Password"
            input "#password", type: 'password'
          div '.four.columns', ->
            label for: 'patient', 'Client'
            select '#patient.u-full-width', ->
              option "Select ---"
              for patient  in @admin.get('user').toArray()
                option value: patient.get('name'), patient.get('name')
        div '.row', ->
          div '.nine.columns', ->
            raw '&nbsp;'
          button '#done.three.columns', disabled: true, "Done"

  modelCheck = (me)->
    model = @sessionInfo
    if (model.get 'TestID') && (model.get 'hostUrl') && (model.get 'clinician') && (model.get 'patient')
      console.log('activating')
      me.activateButtons selector: "#done", funct: me.done, text: "Done"
    return

  wireButtons: ->
    model = @sessionInfo
    me = @
    $('#TestID').change (node)->
      model.set 'TestID',$('#TestID option:selected').val()
      modelCheck(me)

  wireAdmin: ->
    model = @sessionInfo
    me = @
    $('#desiredHost').change (node) ->
      model.set 'hostUrl',$('#desiredHost option:selected').val()
      modelCheck(me)
    $('#clinician').change (node) ->
      model.set 'clinician',$('#clinician option:selected').val()
      modelCheck(me)
    $('#patient').change (node) ->
      model.set 'patient', $('#patient option:selected').val()
      modelCheck(me)

  buttons: renderable ()->
      div '.row', ->
        button '#admin.three.columns button-primary', 'Admin'
        button '.three.columns.disabled', ''
        button '.three.columns.disabled', ''
        button '#debug.three.columns.disabled', ''
      div '.row', ->
        button '#action.three.columns.disabled', ''
        button '#upload.three.columns.disabled', 'Upload'
        button '#reset.three.columns.disabled', 'Reset'
        div '.three.columns', ->
          label for: "TestID", 'Which Test?'
          select "#TestID.u-full-width",  ->
            option "Select ---"
            for k, test of @admin.get('testIDs')
              option value: k, test

  sensorContents: renderable ->
      hr()
      div '.row.readings', ->
        div '#gyroscope.four.columns', ->
          h4 'Gyroscope'
          canvas '#gyro-view', width: '200', height: '200', style: 'width=100%'
          div '#GyroscopeData.u-full-width.dump', ' '
          #button '#calibrateGyro.suppress.three columns', 'Debias'
        div '#acelleration.four.columns', ->
          h4 'Accelerometer'
          canvas '#accel-view', width: '200', height: '200', style: 'width=100%'
          div '#AccelerometerData.u-full-width.dump', ' '
          #button '#calibrateAccel.suppress.three columns', 'Debias'
        div '#magnetometer.four.columns', ->
          h4 'Magnetometer'
          canvas '#magnet-view', width: '200', height: '200', style: 'width=100%'
          div '#MagnetometerData.u-full-width.dump', ''
          #button '#calibrateMag.suppress.three columns', 'Debias'
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

  deactivateButtons: (buttons...) ->
    for btn in  buttons
      b=$(btn.selector).removeClass('button-primary').attr('disabled','disabled').off('click')
      if btn.text? then b.text(btn.text)
      b.fadeTo(500,0.25)

  activateButtons: (buttons...) ->
    for btn in  buttons
      b=$(btn.selector).addClass('button-primary').removeAttr('disabled').off('click')
      if btn.funct? then b.on('click',btn.funct)
      if btn.text? then b.text(btn.text)
      b.show().fadeTo(500,1)

  activateAdminPage: (@done) ->
    bodyHtml = pageGen.theBody pageGen.buttons , pageGen.adminContents, pageGen.sensorContents
    $('body').html bodyHtml
    @wireButtons()
    @wireAdmin()

  activateSensorPage: (buttonspec)->
    $('#adminForm').hide()
    activateButtons buttonspec if buttonspec?
