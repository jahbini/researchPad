# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('Backbone')
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
        a href: '/index.html', ->
          img "#logo.five.columns", src: './ui/images/logo-final.png', width: '100%'
        div '#dud.one.columns', ->
          raw '&nbsp;'
        img ".five.columns", src: './ui/images/movdatcap.png', width: '100%'
      buttons()
      div '.row',->
        div '.two.columns',"First Tag"
        div '.three.columns', ->
          span '#FirstNick', '?'
        div '#Firstuuid.seven.columns' , ' '
      div '.row',->
        div '.two.columns',"Second Tag"
        div '.three.columns', ->
          span '#SecondNick', '?'
        div '#Seconduuid.seven.columns' , ' '
      div '.row', ->
        div '.five.columns',"Platform UUID"
        div '#platformUUID.seven.columns', ->
          raw '&nbsp;'
      raw contents1()
      div "#tagScanReport"
      div '#footer','style="display:none;"', ->
        hr()
        div '#console-log.container'
    # the upload report success/fail
    div "#upload-report.modal", ->
      tag "header", ->
        h2 "Upload Status"
      tag "section", ->
        p "#upload-result", "Lorem ipsum dolor sit amet, consectetur amis at adipisicing elit. Maiores quaerat est officia aut nam amet ipsum natus corporis adipisci cupiditate voluptas unde totam quae vel error neque odio id etas lasf reiciendis."
      button ".one.column.close.toggleModle", "Close" 
    div "#count-down.modal", ->
      tag "header", ->
        h2 "Wubba Woo"
      tag "section", ->
        p "#downCount", "Lorem ipsum dolor so sad..."
      button ".one.column.close.toggleModle", "Close" 


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
            th "Sensor"
            th "Gyroscope"
            th "Accelerometer"
            th "Magnetometer"
        for device in sensorTags
          theUUID = device.get 'UUID'
          tbody ->
            tr ->
              td ->
                button '#connect-'+theUUID+'.needsclick.u-full-width.'+device.get('buttonClass')
                  ,onClick: "Pylon.trigger('enableTag', '" + theUUID + "')"
                  ,device.get 'buttonText'
                text (device.get 'nickname')
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
          button '#tagSelect.u-full-width.button-primary', 'Scan Devices'
          label '#StatusData',for: "upload", 'No connection'
        div '.three.columns', ->
          label '#TestSelect', for: "TestID", 'Which Test?'
          select "#TestID.u-full-width"
        div '.three.columns', ->
          button '#upload.disabled.u-full-width', 'Upload'
          label '#FirstStat', for: "upload", 'Items:0'
        div '.three.columns', ->
          button '#clear.u-full-width.disabled', 'Reset'
          label '#SecondStat', for: "clear", 'Items:0'

  tagSelector: renderable ()=>
    
  forceTest: (color = 'violet') =>
    $('#TestSelect').text('Must Select Test').css('color',color)
    $('#TestID').val('Select --')
    Pylon.get('sessionInfo').unset 'testID', silent: true

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

  wireButtons: =>
    model = Pylon.get('sessionInfo')
    $('#TestID').change (node)=>
      $('#TestSelect').text('Which Test?').css('color','')
      model.set 'testID',$('#TestID option:selected').val()
      return false

  renderPage: ()=>
    bodyHtml = @theBody @topButtons , Pylon.get('adminView').adminContents
    $('body').html bodyHtml
    @wireButtons()
    require('./modalViews.coffee')

    testViewTemplate = Backbone.View.extend
      el: '#TestID'
      collection: Pylon.get('tests')
      attributes:
        session: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @collection, 'change', @render
        @render()
      events:
        'change': ->
          @attributes.session.set 'testID',@$el.val()
          return false
      render: ->
        @$el.html render =>
          option "Select ---"
          for test in @collection.models
            if test.get('force')
              option '.forceSelect.selected', selected: 'selected', value: test.get('testID'), test.get('testID')
            else
              option value: test.get('name'), test.get('Description')
        return this
    @testView = new testViewTemplate

    Pylon.on 'change:First', ()=>
      dev = Pylon.get 'First'
      readings = dev.get 'readings'
      console.log "activating First"
      statusFirstViewTemplate = Backbone.View.extend
        collection: readings
        el: "#FirstStat"
        initialize: ->
          console.log "Creation of readings (collection) for First"
          @listenTo @collection, 'change', @render
          @listenTo @collection, 'reset', @render
        render: ->
          @$el.html "Items: "+@collection.length
      Pylon.set("FirstView", new statusFirstViewTemplate)
      return

    Pylon.on 'change:Second', ()=>
      dev = Pylon.get 'Second'
      readings = dev.get 'readings'
      console.log "Creation of readings (collection) for Second"
      statusSecondViewTemplate = Backbone.View.extend
        el: "#SecondStat"
        collection: readings
        initialize: ->
          @listenTo @collection, 'change', @render
          @listenTo @collection, 'reset', @render
        render: ->
          @$el.html "Items: "+@collection.length
      Pylon.set("SecondView", new statusSecondViewTemplate)
      return
    Pylon.get('adminView').wireAdmin()
    return

  activateAdminPage: (buttonSpec)->
    $('#sensorPage').hide()
    $('#adminForm').show()
    Pylon.get('adminView').inspectAdminPage()
    @activateButtons buttonSpec if buttonSpec?


  activateSensorPage: (buttonSpec)->
    $('#adminForm').hide()
    $('#sensorPage').show()
    @activateButtons buttonSpec if buttonSpec?


exports.Pages = Pages
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
