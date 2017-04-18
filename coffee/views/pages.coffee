# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')

buglog = require '../lib/buglog.coffee'
viewlogger = (viewlog= new buglog "view").log

RssiView = require './rssi-view.coffee'

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
        div '#RightVersion.three.columns' , ' '
        div '#RightSerialNumber.three.columns', ' '
      div '.row',->
        div '.two.columns',"Left Tag"
        div '#LeftVersion.three.columns' , ' '
        div '#LeftSerialNumber.three.columns',  ' '
      div '.row', ->
        div '.three.columns',"Platform UUID"
        div '#platformUUID.five.columns', ->
          raw '&nbsp;'
        div '#platformIosVersion.two.columns', ->
          raw '&nbsp;'
        div '#UploadCount.two.columns',"Queued:0"
      raw contents1()
      div "#scanActiveReport"
      div '#footer', style: "display:none;", ->
        hr()
        div '#console-log.container'
    # the test activity portal -- populated in modalView.coffee
    div "#recorder.modal",->
      div "#count-down"
      div "#protocol-report", style: "display:none;"
    return

  scanBody: renderable ()->
    hr()
    table ".u-full-width", ->
      thead ->
        tr ->
          th "Available Sensors"
          th "Gyroscope"
          th "Accelerometer"
          th "Magnetometer"
        tbody "#sensor-1"
        tbody "#sensor-2"

  sensorView: (device)->
    domElement = '#'+device.get 'rowName'
    view = Backbone.View.extend
      el: domElement
      initialize: (device)->
        @model = device
        @$el.html @createRow device
        new RssiView device
        @render()
        @.listenTo device, 'change:deviceStatus', ()->
          @$('.status').html device.get 'deviceStatus'
        @.listenTo device, 'change:firmwareVersion', ()->
          @$('.version').html device.get 'firmwareVersion'
        @.listenTo device, 'change:role', @render
        @.listenTo Pylon, 'change:Left', @render
        @.listenTo Pylon, 'change:Right', @render
        @.listenTo Pylon, 'change:Guess', @render
        @.listenTo device, 'change:buttonText', @render
        @.listenTo device, 'change:buttonClass', @render

      createRow: (device)->
        rowName = device.get 'rowName'
        svgElement = '#rssi-'+rowName
        gyroElement = '#gyro-'+rowName
        accelElement = '#accel-'+rowName
        magElement = '#mag-'+rowName
        render ->
          tr ->
            td ->
              div '.assignedName',device.get 'name'
              span '.version'
              br()
              span '.status',"advertising" 
            td ->
              button '.connect.needsclick.u-full-width.'+device.get('buttonClass')
                ,onClick: "Pylon.trigger('enableDevice', '#{device.cid}' )"
                , "Connect"
            td ->
              button '.disconnect.needsclick.u-full-width.'+device.get('buttonClass')
                ,onClick: "Pylon.trigger('disableDevice', '#{device.cid}' )"
                , "Disconnect"
            td ->
              tea.tag "svg", svgElement, height: "1.5em", width: "1.5em"
          tr ->
            td ""
            td ->
              canvas gyroElement, width: '100', height: '100', style: 'width=100%'
            td ->
              canvas accelElement, width: '100', height: '100', style: 'width=100%'
            td ->
              canvas magElement, width: '100', height: '100', style: 'width=100%'
      render: ()->
        device = @model
        buttonClass = device.get 'buttonClass'
        buttonText = device.get 'buttonText'

        # single connect button if connected, then show it as left or right
        if 'Guess' == device.get 'role'  # if we are not already Right
          @$('.connect').addClass('disabled').prop('disabled',true).html "Active ?"
        if 'Right' == device.get 'role'  # if we are not already Right
          @$('.connect').addClass('disabled').prop('disabled',true).html "Active Right"
          return
        if 'Left' == device.get 'role'  # if we are already Left, we cant change
          @$('.connect').addClass('disabled').prop('disabled',true).html "Active Left"
          return
        # this device is not connected.
        @$('.connect').addClass(buttonClass).removeClass('disabled').prop('disabled',false).html buttonText
        return
    return new view device

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

  forceTest: (color = 'violet',txt='Must Select Test') =>
    $('#ProtocolSelect').text(txt).css('color',color)
    Pylon.trigger 'renderTest'
    Pylon.get('sessionInfo').unset 'testID', silent: true

  wireButtons: =>
    # all buttons converted to button-view objects
    # only remaining widget is protocol ID selector
    model = Pylon.get('sessionInfo')
    $('#testID').change (node)=>
      $('#ProtocolSelect').text('Which Protocol?').css('color','')
      model.set 'testID',$('#testID option:selected').val()
      (Pylon.get 'button-admin').set
        legend: "Session?"
        enable: false
      model.save null,{
        success: (model,response,options)->
          viewlogger "session logged with host"
          (Pylon.get 'button-admin').set
            legend: "Log Out"
            enable: true
        error: (model,response,options)->
          viewlogger "Session save Fail: #{response.statusText}"
          (Pylon.get 'button-admin').set
            legend: "Log Out"
            enable: true
        }
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
          @attributes.session.set 'captureDate',Date.now()
          return false
      render: ->
        viewlogger "Rendering Tests"
        @$el.html render =>
          option '.selected', selected: 'selected', value: '', "Select ---"
          for protocol in @collection.models
              option value: protocol.get('name'), protocol.get('name')
        return this
    @protocolView = new protocolViewTemplate

    Pylon.on 'change:Right', ()=>
      dev = Pylon.get 'Right'
      return unless dev
      viewlogger "activating Right"
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
      return unless dev
      viewlogger "activating Left"
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
