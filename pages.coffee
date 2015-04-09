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
  {a,render,input,renderable,raw,div,img,h2,h3,h4,h5,label,button,p,text,span,canvas,option,select,form,body,head,doctype,hr,br,password} = tea.tags()

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
        a href: '/index.html', ->
          img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
        div '#dud.one.columns', ->
          raw '&nbsp;'
        h5 '.five.columns', 'Movement data capture'
      buttons()
      div '.row',->
        div '.two.columns',"Sensor --"
        div '.two.columns', ->
          text 'Version:'
          span '#FirmwareData', '?'
        div '#uuid.five.columns' , ' '
      div '.row', ->
        div '.four.columns',"Platform uuid"
        div '#platformUUID.five.columns', ->
          raw '&nbsp;'
        
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
          div '.five.columns', ->
            label 'Remote Host'
            select '#desiredHost.u-full-width', onchange: "" , 'Host', ->
              option "Select ---"
              for host in @getAdmin('host')
                if host.get('force')
                  option '.forceSelect.selected', selected: 'selected', value: host.get('url'), host.get('name')
                else
                  option value: host.get('url'), host.get('name')
        div '.row', ->
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
              for p in @getAdmin('user') when p.get('patientOnly')
                option value: p.get('name'), p.get('name')
        div '.row', ->
          div '.nine.columns', ->
            raw "&nbsp;"
          button '#done.three.columns', disabled: true, "Done"

  modelCheck: ()=>
    model = @sessionInfo
    if (model.get 'hostUrl') && (model.get 'clinician') && 
      (model.get 'patient') && 'retro2015' == (model.get 'password').slice(0,9)
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
      return false

  resetAdmin: =>
    @sessionInfo.set('clinician','')
    @sessionInfo.set('password','')
    @sessionInfo.set('patient','')
    @sessionInfo.set('testID','')

    $('#password').val('')
    $('option:selected').prop('selected',false)
    $('option.forceSelect').prop('selected',true)
    $('#done').removeClass('button-primary').addClass('disabled').attr('disabled','disabled').off('click')
    @sessionInfo.set 'hostUrl',$('#desiredHost option:selected').val()

  wireAdmin: =>
    model = @sessionInfo
    model.set 'hostUrl',$('#desiredHost option:selected').val()
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
        button '#calibrate.three.columns.disabled.grayonly', 'Calibrate'
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
          h5 'Gyroscope'
          canvas '#gyro-view', width: '200', height: '200', style: 'width=100%'
          div '#GyroscopeData.u-full-width.dump', ' '
          #button '#calibrateGyro.suppress.three columns', 'Debias'
        div '#acelleration.four.columns', ->
          h5 'Accelerometer'
          canvas '#accel-view', width: '200', height: '200', style: 'width=100%'
          div '#AccelerometerData.u-full-width.dump', ' '
          #button '#calibrateAccel.suppress.three columns', 'Debias'
        div '#magnetometer.four.columns', ->
          h5 'Magnetometer'
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
