# vim: et:ts=2:sw=2:sts=2:nowrap

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

class Pages
  Teacup = require('teacup')
  $=require('jquery')
  tea = new Teacup.Teacup
  {render,input,renderable,raw,div,img,h2,h3,h4,label,button,p,text,span,canvas,option,select,form,body,head,doctype,hr,br,password} = tea.tags()

  sessionInfo: {}

  admin: {}

  getAdmin: (kind) =>
    return @admin.get(kind).toArray()

  constructor: (@admin,@sessionInfo) ->
      tea.getAdmin =  @getAdmin
      #Teacup.Teacup.prototype.admin = @admin
      #Teacup.Teacup.prototype.Page = @

  theBody: renderable (buttons,contents1,contents2)=>
    div '#capture-display.container', ->
      div '.row', ->
        img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
        div '#dud.one.columns', ->
          raw '&nbsp;'
        h4 '.five.columns', 'Movement data capture'
      buttons()
      div '.row',->
        div '.two.columns',"device --"
        div '.two.columns', ->
          text 'Version:'
          span '#FirmwareData', '?'
        div '#uuid.six.columns' , ' '
      contents1()
      contents2()
      div '#footer','style="display:none;"', ->
        hr()
        div '#console-log.container'

  adminContents: renderable ()->
     div '#adminForm', ->
      hr() 
      form ->
        div '.row', ->
          div '.two.columns', ->
            label 'Remote Host'
            select '#desiredHost.u-full-width', onchange: "" , 'Host', ->
              option "Select ---"
              for host in @getAdmin('host')
                option value: host.get('url'), host.get('name')
          div '.four.columns', ->
            label for: 'clinician','Clinician'
            select '#clinician.u-full-width', ->
              option "Select ---"
              for user in @getAdmin('user') when !user.get('patientOnly')
                option value: user.get('name'), user.get('name')
            br()
            label for: "password", "Enter Password"
            input "#password", type: 'password'
          div '.four.columns', ->
            label for: 'patient', 'Client'
            select '#patient.u-full-width', ->
              option "Select ---"
              for patient  in @getAdmin('user')
                option value: patient.get('name'), patient.get('name')
        div '.row', ->
          div '.two.columns',"Platform uuid"
          div '#platformUUID.six.columns', ->
            raw '&nbsp;'
          div '.one.columns', ->
            raw '&nbsp;'
          button '#done.three.columns', disabled: true, "Done"

  modelCheck: ()=>
    model = @sessionInfo
    if (model.get 'testID') && 
      (model.get 'hostUrl') && (model.get 'clinician') && 
      (model.get 'patient') && (model.get 'password')
        console.log('activating')
        b=$('#done')
        b.addClass('button-primary').removeClass('disabled').removeAttr('disabled')
        b.on 'click', @done
        b.text "Done"
        b.show().fadeTo(500,1)
        return true
    return false
  
  wireButtons: =>
    model = @sessionInfo
    $('#TestID').change (node)=>
      $('#TestSelect').text('Which Test?').css('color','')
      model.set 'testID',$('#TestID option:selected').val()
      @modelCheck()

  wireAdmin: =>
    model = @sessionInfo
    $('#desiredHost').change (node) =>
      model.set 'hostUrl',$('#desiredHost option:selected').val()
      @modelCheck()
      return false
    $('#clinician').change (node) =>
      model.set 'clinician',$('#clinician option:selected').val()
      @modelCheck()
      return false
    $('#patient').change (node) =>
      model.set 'patient', $('#patient option:selected').val()
      @modelCheck()
      return false
    $('#password').keypress( (node)=>
        if (node.keyCode == 13 && !node.shiftKey)
          node.preventDefault(); #disallow page reload default

          if $('#password')?.val
            model.set 'password', $('#password').val()
            @modelCheck()
            return false #stop bubble up
        return
       ).on 'blur', (node) =>
          if $('#password')?.val
            model.set 'password', $('#password').val()
            @modelCheck()
            return false #stop bubble up
    return   #otherwise allow bubble-up and default action

  topButtons: renderable ()->
      div '.row', ->
        button '#admin.three.columns button-primary', 'Admin'
        button '#calibrate.three.columns.disabled', 'Calibrate'
        button '.three.columns.disabled', style: "opacity:0.25;", ''
        button '#debug.three.columns.disabled', ''
      div '.row', ->
        div '.three.columns', ->
          select "#TestID.u-full-width",  ->
            option "Select --"
            for test in @getAdmin('testIDs')
              option value: test.get('name') , test.get('Description')
          label '#TestSelect', for: "TestID", 'Which Test?'
        div '.three.columns', ->
          button '#action.disabled.u-full-width', ''
          label '#TotalReadings', for: "action", ' 0'
        div '.three.columns', ->
          button '#upload.disabled.u-full-width', 'Upload'
          label '#StatusData',for: "upload", 'No connection'
        button '#clear.three.columns.disabled', 'Reset'

  forceTest: (color = 'violet') =>
    $('#TestSelect').text('Must Select Test').css('color',color)
    $('#TestID').val('Select --')
    @sessionInfo.set('testID',null)

  sensorContents: renderable ->
    div '#sensorPage.container', ->
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

  activateButtons: (buttonStruct) ->
    for key, btn of buttonStruct
      btn=btn.toJSON()
      selector = '#' + btn.selector
      if btn.active
        b=$(selector).addClass('button-primary').removeClass('disabled').removeAttr('disabled').off('click')
        if btn.funct? then b.on('click',btn.funct)
        if btn.text? then b.text(btn.text)
        b.show().fadeTo(500,1)
      else
        b=$(selector).removeClass('button-primary').addClass('disabled').attr('disabled','disabled').off('click')
        if btn.text? then b.text(btn.text)
        b.fadeTo(500,0.25)

  renderPage: (@done) =>
    bodyHtml = @theBody @topButtons , @adminContents, @sensorContents
    $('body').html bodyHtml
    @wireButtons()
    @wireAdmin()
    return

  activateAdminPage: (buttonSpec)->
    $('#sensorPage').hide()
    $('#adminForm').show()
    @activateButtons buttonSpec if buttonSpec?

  activateSensorPage: (buttonSpec)->
    $('#adminForm').hide()
    $('#sensorPage').show()
    @activateButtons buttonSpec if buttonSpec?

exports.Pages = Pages
