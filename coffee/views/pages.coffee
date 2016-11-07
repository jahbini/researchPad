# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

Pylon.set 'adminView', require('./adminView.coffee').adminView

class Pages
  tea = new Teacup.Teacup
  {table,tr,th,thead,tbody,td,ul,li,ol,a,render
    ,input,renderable,raw,div,img,h2,h3,h4,h5,label
    ,button,p,text,span,canvas,option,select,form
    ,body,head,doctype,hr,br,password,tag} = tea.tags()

  constructor: () ->

  theBody: renderable (buttons,contents1)=>
    div '#capture-display.container', ->
      div '.row', ->
        img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
        div '#dud.one.columns', ->
          raw '&nbsp;'
        img ".five.columns", src: './ui/images/movdatcap.png', width: '100%'
      div '#net-info.row', ->
        div '#net-wifi.six.columns'
        div '#net-ble.six.columns'
      buttons()
      div '.row',->
        div '.two.columns',"Right Tag"
        div '.three.columns', ->
          span '#RightNick', '?'
        div '#Rightuuid.seven.columns' , ' '
      div '.row',->
        div '.two.columns',"Left Tag"
        div '.three.columns', ->
          span '#LeftNick', '?'
        div '#Leftuuid.seven.columns' , ' '
      div '.row', ->
        div '.three.columns',"Platform UUID"
        div '#platformUUID.five.columns', ->
          raw '&nbsp;'
        div '.two.columns',"OS V"
        div '#platformIosVersion.two.columns', ->
          raw '&nbsp;'
      raw contents1()
      div "#scanActiveReport"
      div '#footer','style="display:none;"', ->
        hr()
        div '#console-log.container'
    # the test activity portal -- populated in modalView.coffee
    div "#recorder.modal",->
      div "#count-down"
      div "#protocol-report"
    return

  scanContents: renderable (pylon)->
      sensorTags = pylon.get('devices')?.models || []
      hr()
      table ".u-full-width", ->
        thead ->
          tr ->
            th "Available Sensors"
          if sensorTags.length == 0
            th "no sensors respond"
            return
          else
            th "Gyroscope"
            th "Accelerometer"
            th "Magnetometer"
        for device in sensorTags
          theUUID = device.get 'origUUID'
          tbody ->
            tr ->
              td ->
                name = device.get 'assignedName'
                name  = '' unless name
                div "#assignedName-"+theUUID, name
                text (device.get 'UUID')
                br()
                span "#status-"+theUUID, (device.get 'deviceStatus')
                br()
                sig = device.get 'signalStrength'
                if sig < -90
                  color = "#800000"
                else if sig < -75
                  color = "#533659"
                else if sig < -60
                  color = "#2d63a6"
                else if sig < -50
                  color = "#2073Bf"
                else if sig < -40
                  color = "#0099ff"
                modifier = ".fa.fa-signal.fa-3x"
                span "#rssi-"+theUUID+modifier, style: 'color:'+color, sig
              td ->
                if 'Right' != device.get 'role'  # if we are not already Right
                  pylonLeft = Pylon.get('Left') || device  # is left taken?
                  if  device == pylonLeft
                    # when device is connected, disable my buttons - https://github.com/jahbini/stagapp/issues/73
                    if device.get 'connected'
                      button '#connect-l-'+theUUID+'.disabled.u-full-width.'+device.get('buttonClass')
                        ,device.get('buttonText') + "(L)"
                    else
                      button '#connect-l-'+theUUID+'.needsclick.u-full-width.'+device.get('buttonClass')
                        ,onClick: "Pylon.trigger('enableLeft', '" + theUUID + "')"
                        ,device.get('buttonText') + "(L)"
                  else
                    button '.disabled.u-full-width', "unavailable"
                else   # disable left side button with text to indicate right limb
                  button '.disabled.u-full-width', "Right"
              td ->
                if 'Left' != device.get 'role' # have we been assigned as Left?
                  pylonRight = Pylon.get('Right') || device  # No, is right taken?
                  if device == pylonRight
                    # when device is connected, disable my buttons - https://github.com/jahbini/stagapp/issues/73
                    if device.get 'connected'
                      button '#connect-r-'+theUUID+'.disabled.u-full-width.'+device.get('buttonClass')
                        ,device.get('buttonText') + "(R)"
                    else
                      button '#connect-r-'+theUUID+'.needsclick.u-full-width.'+device.get('buttonClass')
                        ,onClick: "Pylon.trigger('enableRight', '" + theUUID + "')"
                        ,device.get('buttonText') + "(R)"
                  else
                    button '.disabled.u-full-width', "unavailable"
                else
                  button '.disabled.u-full-width', "Left"
            tr ->
              td ->
                canvas '#gyro-view-'+theUUID, width: '200', height: '200', style: 'width=100%'
              td ->
                canvas '#accel-view-'+theUUID, width: '200', height: '200', style: 'width=100%'
              td ->
                canvas '#magnet-view-'+theUUID, width: '200', height: '200', style: 'width=100%'


  topButtons: renderable ()->
      div '.row', ->
        button '#admin.three.columns button-primary', 'Admin'
        button '#action.disabled.three.columns', ''
        button '#calibrate.three.columns.disabled.grayonly', 'Calibrate'
        button '#debug.three.columns.disabled', ''
      div '.row', ->
        div '.three.columns', ->
          button '#scanDevices.u-full-width.button-primary', 'Scan Devices'
          label '#StatusData',for: "upload", 'No connection'
        div '.three.columns', ->
          label '#ProtocolSelect', for: "testID", 'Which Test?'
          select "#testID.u-full-width"
        div '.three.columns', ->
          button '#upload.disabled.u-full-width', 'Upload'
          label '#LeftStat', for: "clear", 'Items:0'
        div '.three.columns', ->
          button '#clear.u-full-width.disabled', 'Reset'
          label '#RightStat', for: "upload", 'Items:0'

  forceTest: (color = 'violet') =>
    $('#ProtocolSelect').text('Must Select Test').css('color',color)
    Pylon.trigger 'renderTest'
    Pylon.get('sessionInfo').unset 'testID', silent: true

  activateButtons: (buttonStruct) ->
    for key, btn of buttonStruct
      btn=btn.toJSON()
      selector = '#' + btn.selector
      if btn.active
        b=$(selector).addClass('button-primary').removeClass('disabled').removeAttr('disabled').off('click')
        if btn.text? then b.text(btn.text)
        if btn.funct? then b.on 'click',
          Pylon.trigger 'systemEvent',  b.text()
          btn.funct
        b.show().fadeTo(500,1)
      else
        b=$(selector).removeClass('button-primary').addClass('disabled').attr('disabled','disabled').off('click')
        if btn.text? then b.text(btn.text)
        b.fadeTo(500,0.25)

  wireButtons: =>
    model = Pylon.get('sessionInfo')
    $('#testID').change (node)=>
      $('#ProtocolSelect').text('Which Protocol?').css('color','')
      model.set 'testID',$('#testID option:selected').val()
      try
        model.save
          success: ()->
            console.log "session logged with host"
            console.log "now =", model
            console.log "attributes =", model.attributes
          failure: (e)->
            console.log "Session save Fail: #{e}"
          error: (e="unknown")->
            console.log "Session save Fail: #{e}"
      catch nasty
        alert "sync fail"
        console.log model
        console.log model.attributes
      return false

  renderPage: ()=>
    bodyHtml = @theBody @topButtons , Pylon.get('adminView').adminContents
    $('body').html bodyHtml
    @wireButtons()
    require('./count-up-down.coffee')
    require('./protocol-active.coffee')

    protocolViewTemplate = Backbone.View.extend
      el: '#testID'
      collection: Pylon.get('protocols')
      attributes:
        session: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @collection, 'change', @render
        Pylon.on "renderTest", =>
          @render()
        @render()
      events:
        'change': ->
          @attributes.session.set 'testID',@$el.val()
          return false
      render: ->
        console.log "Rendering Tests"
        @$el.html render =>
          option '.selected', selected: 'selected', value: '', "Select ---"
          for protocol in @collection.models
              option value: protocol.get('name'), protocol.get('name')
        return this
    @protocolView = new protocolViewTemplate

    Pylon.on 'change:Right', ()=>
      dev = Pylon.get 'Right'
      console.log "activating Right"
      if old = Pylon.get 'RightView'
        old.clearTimer()
      statusRightViewTemplate = Backbone.View.extend
        model: dev
        el: "#RightStat"
        clearTimer: ->
          clearInterval @timeScanner
        initialize: ->
          @timeScanner= setInterval @render.bind(@), 40
          @model.set 'numReadings',0
          @listenTo @model, 'change', @render
        render: ->
          @$el.html "Items: "+ @model.get 'numReadings'
      Pylon.set("RightView", new statusRightViewTemplate)
      return

    Pylon.on 'change:Left', ()=>
      dev = Pylon.get 'Left'
      console.log "activating Left"
      statusLeftViewTemplate = Backbone.View.extend
        model: dev
        el: "#LeftStat"
        clearTimer: ->
          clearInterval @timeScanner
        initialize: ->
          @timeScanner= setInterval @render.bind(@), 40
          @model.set 'numReadings',0
          @listenTo @model, 'change', @render
        render: ->
          @$el.html "Items: "+ @model.get 'numReadings'
      Pylon.set("LeftView", new statusLeftViewTemplate)
      return
    Pylon.get('adminView').wireAdmin()
    return

  activateAdminPage: (buttonSpec)->
    $('#adminForm').addClass 'active'
    $('#sensorPage').removeClass 'active'
    Pylon.get('adminView').inspectAdminPage()

  activateSensorPage: (buttonSpec)->
    $('#adminForm').removeClass 'active'
    $('#sensorPage').addClass 'active'

exports.Pages = Pages
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
