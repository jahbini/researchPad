# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')

buglog = require '../lib/buglog.coffee'
viewlogger = (viewlog= new buglog "view").log


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

  Pylon.on 'systemEvent:sanity:failRight',()->
    $("#RightStatus").removeClass("led-green led-yellow led-blue led-dark").addClass("led-red")
  Pylon.on 'systemEvent:sanity:failLeft',()->
    $("#LeftStatus").removeClass("led-green led-yellow led-blue led-dark").addClass("led-red")
    
  Pylon.on 'systemEvent:sanity:disconnectRight',()->
    w=$("#RightStatus")
    w.removeClass("led-green led-yellow led-blue led-red")
      .addClass("led-dark") unless w.hasClass "led-red"
  
  Pylon.on 'systemEvent:sanity:disconnectLeft',()->
    w=$("#LeftStatus")
    w.removeClass("led-green led-yellow led-blue led-red")
      .addClass("led-dark") unless w.hasClass "led-red"
    
  Pylon.on 'systemEvent:sanity:activeRight',()->
    $("#RightStatus").removeClass("led-dark led-yellow led-blue led-red").addClass("led-green")
  Pylon.on 'systemEvent:sanity:activeLeft',()->
    $("#LeftStatus").removeClass("led-dark led-yellow led-blue led-red").addClass("led-green")
    
  Pylon.on 'systemEvent:sanity:warnRight',()->
    $("#RightStatus").removeClass("led-dark led-green led-blue led-red").addClass("led-yellow")
  Pylon.on 'systemEvent:sanity:warnLeft',()->
    $("#LeftStatus").removeClass("led-dark led-green led-blue led-red").addClass("led-yellow")
    
  Pylon.on 'systemEvent:sanity:idleRight',()->
    w=$("#RightStatus")
    w.removeClass("led-dark led-green led-yellow led-red")
      .addClass("led-blue") unless w.hasClass "led-red"
  Pylon.on 'systemEvent:sanity:idleLeft',()->
    w=$("#LeftStatus")
    w.removeClass("led-dark led-green led-yellow led-red")
      .addClass("led-blue") unless w.hasClass "led-red"
  
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
        div '#sensor-Left',->
          div '#leftVertmeter.one.columns.vertmeter', ->
            div '.bar',style: 'height:0'
          div '.sensorElement.five.columns', ->
            div '.va-mid',->
              span '#LeftStatus.led-box.led-dark'
              span '#LeftSerialNumber.mr-rt-10', 'Serial number'
            div '.status', '---'
            div '#LeftVersion',  'Version'
            div '#LeftAssignedName', 'Name'
            ###
            div '#sensor-Left',->
              button '.connect.needsclick'
                ,onClick: "Pylon.trigger('enableDevice', Pylon.get('Left').cid )"
                , "Connect"
              button '.disconnect.needsclick'
                ,onClick: "Pylon.trigger('disableDevice', Pylon.get('Left').cid )"
                , "Disconnect"
            ###
        div '#sensor-Right',->
          div '#rightVertmeter.one.columns.vertmeter', ->
            div '.bar',style: 'height:0'
          div '.sensorElement.five.columns', ->
            div '.va-mid',->
              span '#RightStatus.led-box.led-dark'
              span '#RightSerialNumber.mr-rt-10' , 'Serial number'
            div '.status', '---'
            div '#RightVersion', 'Version'
            div '#RightAssignedName', 'Name'
            ###
            div '#sensor-Right',->
              button '.connect.needsclick'
                ,onClick: "Pylon.trigger('enableDevice', Pylon.get('Right').cid )"
                , "Connect"
              button '.disconnect.needsclick'
                ,onClick: "Pylon.trigger('disableDevice', Pylon.get('Right').cid )"
                , "Disconnect"
            ###
      div '.row', ->
        div '.three.columns',"Platform UUID"
        div '#platformUUID.five.columns', ->
          raw '&nbsp;'
        div '#platformIosVersion.two.columns', ->
          raw '&nbsp;'
        div '#UploadCount.two.columns',"Queued:0"
      raw contents1()
      div "#scanningReport"
      div '#footer', style: "display:none;", ->
        hr()
        div '#console-log.container'
    # the test activity portal -- populated in modalView.coffee
    div "#recorder.modal",->
      div "#count-down"
    div "#protocol-report.modal-test", style: "display:none;"
    return

  scanBody: renderable ()->
    hr()
    table ".u-full-width", ->
      tr ->
        tbody "#sensor-Guess"
        tbody "#sensor-1"
        tbody "#sensor-2"
        tbody "#sensor-3"

  sensorView: (device)->
    domElement = '#'+device.get 'rowName'
    view = Backbone.View.extend
      el: domElement
      initialize: (device)->
        @model = device
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
        button '#admin.three.columns.button-primary', 'Admin'
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
    scaleSweetSpot=(v,r)->
      x={ color: "#a22" }
      if v< r.lo
        x.percent = 33*(v/r.lo)
        return x
      if v< r.hi
        x.color = "#2a2"
        x.percent=33+33*((v-r.lo)/(r.hi-r.lo))
        return x
      x.percent=66+33*((v-r.hi)/(100-r.hi))
      x.color = "#22a"
      return x
    setVertmeter=(role)->
      widget=null
      return (val)->
        widget = $("##{role}Vertmeter .bar") unless widget
        scaler = Pylon.get 'vertmeterScale'
        {color,percent} = scaleSweetSpot val,scaler
        widget.css("height", "#{percent}%").css("background-color",color) if widget
        return
        
        
    Pylon.on 'LeftVertmeter', setVertmeter "left"
    Pylon.on 'RightVertmeter', setVertmeter "right"
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
          @listenTo @model, 'change:numReadings', @render
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
