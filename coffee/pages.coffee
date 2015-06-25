# vim: et:ts=2:sw=2:sts=2:nowrap

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference


class Pages
  Teacup = require('teacup')
  Backbone = require('Backbone')
  $=require('jquery')
  tea = new Teacup.Teacup
  {table,tr,th,thead,tbody,td,ul,li,ol,a,render
    ,input,renderable,raw,div,img,h2,h3,h4,h5,label
    ,button,p,text,span,canvas,option,select,form
    ,body,head,doctype,hr,br,password} = tea.tags()

  constructor: () ->

  inspectAdminPage: ()->
    clinicViewTemplate = Backbone.View.extend
      el: '#desiredClinic'
      collection: Pylon.get('clinics')
      attributes:
        session: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @collection, 'change', @render
      events:
        'change': ->
          theOptionCid = @$el.val()
          theClinic = @collection.get( theOptionCid )
          @attributes.session.set 'clinic',theClinic
          temp = Pylon.get('clinicians')
          temp.reset()
          temp.add theClinic.get('clinicians')
          temp.trigger('change')
          temp = Pylon.get('clients')
          temp.reset()
          temp.add theClinic.get('clients')
          temp.trigger('change')
          return false
      render: ->
        @$el.html render =>
          option "Select ---"
          for clinic in @collection.models
            if clinic.get('force')
              option '.forceSelect.selected',
                selected: 'selected'
                value: clinic.cid, clinic.get('name')
            else
              option value: clinic.cid, clinic.get('name')
        return this

    clinicianViewTemplate = Backbone.View.extend
      el: '#desiredClinician'
      collection: Pylon.get('clinicians')
      attributes:
        session: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @collection, 'change', @render
      events:
        'change': ->
          @attributes.session.set 'clinician',@$el.val()
          return false
      render: ->
        temp = render =>
          option "Select ---"
          for user in @collection.models
            n= user.get('name')
            option value: user.get('_id'), n.first + ' ' + n.last
        @$el.html temp
        return this

    clientViewTemplate = Backbone.View.extend
      el: '#desiredClient'
      collection: Pylon.get('clients')
      attributes:
        session: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @collection, 'change', @render
      events:
        'change': ->
          @attributes.session.set 'client',@$el.val()
          return false
      render: ->
        @$el.html render =>
          option "Select ---"
          for p in @collection.models
            n=p.get('name')
            option value: p.get('_id'), n.first + ' ' + n.last
        return this

    doneViewTemplate = Backbone.View.extend
      el: '#done'
      model: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @model, 'change', @render
      events:
        'click': @adminDone
      render: ->
        if (@model.get 'clinic') && (@model.get 'clinician') &&
            (@model.get 'client') && 'retro2015' == (@model.get 'password')?.slice(0,9)
          console.log('activating Admin Done Button')
          @$el.addClass('button-primary').removeClass('disabled').removeAttr('disabled')
          @$el.text "Done"
          @$el.show().fadeTo(500,1)
        return this

    @doneView = new doneViewTemplate
    @clientView = new clientViewTemplate
    @clinicView = new clinicViewTemplate
    @clinicianView = new clinicianViewTemplate
    Pylon.get('clinics').trigger('change')
    return

  theBody: renderable (buttons,contents1)=>
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
      div "#tagScanReport"
      div "#content1", ->
        contents1()
      div '#footer','style="display:none;"', ->
        hr()
        div '#console-log.container'

  scanContents: renderable (pylon)->
      sensorTags = pylon.get('devices')?.models || []
      hr()
      table ".u-full-width", ->
        thead ->
          tr ->
            th "Bluetooth Scan report"
          if sensorTags.length == 0
            th "no sensors respond"
            return
          else
            th "name"
            th "gyro"
            th "accel"
            th "mag"
        for device in sensorTags
          theUUID = device.get 'UUID'
          tbody ->
            tr ->
              td ->
                text (device.get 'nickname')
                br()
                span "#rssi-"+theUUID, device.get 'signalStrength'
                br()
                span "#status-"+theUUID, '--'
                button '.needsclick', onClick: "Pylon.trigger('enableTag', '" + theUUID + "')","Connect"
              td ->
                canvas '#gyro-view-'+theUUID, width: '200', height: '200', style: 'width=100%'
              td ->
                canvas '#accel-view-'+theUUID, width: '200', height: '200', style: 'width=100%'
              td ->
                canvas '#magnet-view-'+theUUID, width: '200', height: '200', style: 'width=100%'
            

  adminContents: renderable ()=>
     div '#adminForm', ->
      hr()
      form ->
        div '.row', ->
          div '.five.columns', ->
            label 'Clinic'
            select '#desiredClinic.u-full-width', 'Clinic', ''
        div '.row', ->
          div '.four.columns', ->
            label for: 'desiredClinician','Clinician'
            select '#desiredClinician.u-full-width'
            br()
            label for: "password", "Enter Password"
            input "#password", type: 'password'
          div '.four.columns', ->
            label for: 'desiredClient', 'Client'
            select '#desiredClient.u-full-width'

        div '.row', ->
          div '.nine.columns', ->
            raw "&nbsp;"
          button '#done.three.columns', disabled: true, "Done"
  wireButtons: =>
    model = Pylon.get('sessionInfo')
    $('#TestID').change (node)=>
      $('#TestSelect').text('Which Test?').css('color','')
      model.set 'testID',$('#TestID option:selected').val()
      return false

  resetAdmin: =>
    model = Pylon.get('sessionInfo')
    model.unset 'clinic', silent: true
    model.unset 'clinician', silent: true
    model.unset 'password', silent: true
    model.unset 'client', silent: true
    model.unset 'testID', silent: true

    $('#password').val('')
    $('option:selected').prop('selected',false)
    $('option.forceSelect').prop('selected',true)
    $('#done').removeClass('button-primary').addClass('disabled').attr('disabled','disabled').off('click')

  wireAdmin: =>
    model = Pylon.get('sessionInfo')
    $('#password').keypress( (node)=>
        if (node.keyCode == 13 && !node.shiftKey)
          node.preventDefault(); #disallow page reload default

          if $('#password')?.val
            model.set 'password', $('#password').val()
            return false #stop bubble up
        return
       ).on 'blur', (node) =>
          if $('#password')?.val
            model.set 'password', $('#password').val()
            return false #stop bubble up
    return   #otherwise allow bubble-up and default action

  topButtons: renderable ()->
      div '.row', ->
        button '#admin.three.columns button-primary', 'Admin'
        button '#calibrate.three.columns.disabled.grayonly', 'Calibrate'
        button '#tagSelect.three.columns button-primary', 'Tag Select'
        button '#debug.three.columns.disabled', ''
      div '.row', ->
        div '.three.columns', ->
          label '#TestSelect', for: "TestID", 'Which Test?'
          select "#TestID.u-full-width"
        div '.three.columns', ->
          button '#action.disabled.u-full-width', ''
          label '#TotalReadings', for: "action", 'Items:0'
        div '.three.columns', ->
          button '#upload.disabled.u-full-width', 'Upload'
          label '#StatusData',for: "upload", 'No connection'
        button '#clear.three.columns.disabled', 'Reset'

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

  renderPage: (@adminDone) =>
    bodyHtml = @theBody @topButtons , @adminContents
    $('body').html bodyHtml
    @wireButtons()
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


    statusViewTemplate = Backbone.View.extend
      collection: Pylon.get 'readings'
      initialize: ->
        @listenTo @collection, 'change', @render
      render: ->
        $("#TotalReadings").html "Items: "+@collection.length()
    @statusView = new statusViewTemplate

    @wireAdmin()
    return

  activateAdminPage: (buttonSpec)->
    $('#sensorPage').hide()
    $('#adminForm').show()
    @inspectAdminPage()
    @activateButtons buttonSpec if buttonSpec?


  activateSensorPage: (buttonSpec)->
    $('#adminForm').hide()
    $('#sensorPage').show()
    @activateButtons buttonSpec if buttonSpec?

exports.Pages = Pages
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
