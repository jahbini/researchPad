# vim: et:ts=2:sw=2:sts=2:nowrap

$=require('jquery')
Backbone = require('backbone')
Teacup = require('teacup')

onOnline = ()->
  console.log "OnLine Event"
CommoState = Backbone.Model.extend
  netState: ()->
    navigator.connection.type
  netAbility: ()->
    return @abiity[@netState()]
    return
  bleState: "Bluetooth OK!"
  bleAbility: true
  initialize: ()->
    try
      document.addEventListener("online", onOnline, false);
      Connection= navigator.connection
      @states[Connection.UNKNOWN]  = 'Unknown connection';
      @states[Connection.ETHERNET] = 'Ethernet connection';
      @states[Connection.WIFI]     = 'WiFi connection';
      @states[Connection.CELL_2G]  = 'Cell 2G connection';
      @states[Connection.CELL_3G]  = 'Cell 3G connection';
      @states[Connection.CELL_4G]  = 'Cell 4G connection';
      @states[Connection.CELL]     = 'Cell generic connection';
      @states[Connection.NONE]     = 'No network connection';

      @ability[Connection.UNKNOWN]  = false
      @ability[Connection.ETHERNET] = true
      @ability[Connection.WIFI]     = true
      @ability[Connection.CELL_2G]  = true
      @ability[Connection.CELL_3G]  = true
      @ability[Connection.CELL_4G]  = true
      @ability[Connection.CELL]     = true
      @ability[Connection.NONE]     = false
    catch
      console.log "ERROR IN ONLINE"
commoState = new CommoState

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

class netView
  tea = new Teacup.Teacup
  {table,tr,th,thead,tbody,td,ul,li,ol,a,render
    ,input,renderable,raw,div,img,h2,h3,h4,h5,label
    ,button,p,text,span,canvas,option,select,form
    ,body,head,doctype,hr,br,password,tag} = tea.tags()

  constructor: () ->

  netViewer: ()->
    netViewTemplate = Backbone.View.extend
      el: '#net-info'
      model: commoState
      initialize: ->
        document.addEventListener("offline", @render, false);
        document.addEventListener("online", @render, false);
        document.addEventListener("offline", @render, false);
        document.addEventListener("offline", @render, false);
      events:
        'change': ->
          theOptionCid = @$el.val()
          console.log 'Clinic Change, CID='+theOptionCid
          if theOptionCid
            theClinic = @collection.get( theOptionCid )
            try
              @attributes.session.set 'clinic',theClinic
            catch error
              console.log "Error from setting clinic"
              console.log error
          else
            theClinic = null;
            @attributes.session.unset 'clinic'
          @attributes.session.unset 'clinician'
          @attributes.session.unset 'client'
          temp = Pylon.get('clinicians')
          temp.reset()
          temp.add theClinic.get('clinicians') if theClinic
          temp.trigger('change')
          temp = Pylon.get('clients')
          temp.reset()
          temp.add theClinic.get('clients') if theClinic
          temp.trigger('change')
          @attributes.session.trigger 'change'
          return false
      #render the clinic drop down list -- if the server is responding
      render: ->
        @$el.html render =>
          option "Select ---",value: ''
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
          temp = @$el.val()
          if temp
            @attributes.session.set 'clinician',temp
          else
            @attributes.session.unset 'clinician'
          @attributes.session.trigger 'change'
          return false
      render: ->
        temp = render =>
          option "Select ---",value: ''
          for who in @collection.models
            n= who.get('name')
            option value: who.get('_id'), n.first + ' ' + n.last
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
          if @$el.val()
            @attributes.session.set 'client',@$el.val()
          else
            @attributes.session.unset 'client'
          @attributes.session.trigger 'change'
          return false
      render: ->
        @$el.html render =>
          option "Select ---",value: ''
          for p in @collection.models
            n=p.get('name')
            option value: p.get('_id'), n.first + ' ' + n.last
        return this

    doneViewTemplate = Backbone.View.extend
      el: '#done'
      model: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @model, 'change', @render
        return @
      events:
        'click':  ->
          Pylon.trigger('adminDone')
          return false
      render: ->
        if (@model.get 'clinic') && (@model.get 'clinician') &&
            (@model.get 'client') && 'retro2015' == (@model.get 'password')?.slice(0,9)
          @$el.addClass('button-primary').removeClass('disabled').removeAttr('disabled')
          @$el.text "Done"
          @$el.show().fadeTo(500,1)
        else
          @$el.removeClass('button-primary').addClass('disabled').attr('disabled')
          @$el.show().fadeTo(100,0.25)
        return this

    @doneView = new doneViewTemplate
    @clientView = new clientViewTemplate
    @clinicView = new clinicViewTemplate
    @clinicianView = new clinicianViewTemplate
    Pylon.get('clinics').trigger('change')
    return


  adminContents: =>
    render () ->
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
            label for: "password", "Password"
            input "#password", type: 'password'
          div '.four.columns', ->
            label for: 'desiredClient', 'Client'
            select '#desiredClient.u-full-width'

        div '.row', ->
          div '.nine.columns', ->
            raw "&nbsp;"
          button '#done.three.columns', disabled: true, "Done"

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

exports.netView = new netView
