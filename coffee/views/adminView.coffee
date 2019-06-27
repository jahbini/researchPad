# vim: et:ts=2:sw=2:sts=2:nowrap

$=require('jquery')
Backbone = require('backbone')
Teacup = require('teacup')

buglog = require '../lib/buglog.coffee'
adminlogger = (adminlog= new buglog "admin").log

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

class adminView
  tea = new Teacup.Teacup
  {table,tr,th,thead,tbody,td,ul,li,ol,a,render
    ,input,renderable,raw,div,img,h2,h3,h4,h5,label
    ,button,p,text,span,canvas,option,select,form
    ,body,head,doctype,hr,br,password,tag} = tea.tags()

  constructor: () ->

  inspectAdminPage: ()->
    clinicViewTemplate = Backbone.View.extend
      el: '#desiredClinic'
      collection: Pylon.get('clinics')
      attributes:
        session: Pylon.get('sessionInfo')
      initialize: ->
        @listenTo @collection, 'change', @render

      # when the clinics selection changes,
      # fill in the client and clinician dropDowns
      events:
        'change': ->
          theOptionCid = @$el.val()
          if theOptionCid
            theClinic = @collection.get( theOptionCid )
            try
              @attributes.session.set 'clinic',theClinic
            catch error
              adminlogger "Error from setting clinic",error
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
          Pylon.trigger 'adminDone'
          Pylon.trigger 'renderTest'
          return false
      render: ->
        pwMatch = (@model.get 'password') == Pylon.loginPassword
        if (@model.get 'clinic') && (@model.get 'clinician') &&
            (@model.get 'client') && pwMatch
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
     div '#adminForm.modal', ->
      tea.h1 "Enter Session Information"
      hr()
      form ->
        div '.row', ->
          div '.four.columns', ->
            label 'Clinic'
            select '#desiredClinic.u-full-width', 'Clinic', ''
          div '.one.column'
          div '.four.columns',->
            label '#lock-label', for: 'lock-down', 'Tests run unlocked'
            button '#lock-down'
        div '.row', ->
          div '.four.columns', ->
            label for: 'desiredClinician','Clinician'
            select '#desiredClinician.u-full-width'
            br()
            label for: "password", "Password"
            input "#password",style:"-webkit-user-select:text;", type: 'password'
          div '.four.columns', ->
            label for: 'desiredClient', 'Client'
            select '#desiredClient.u-full-width'

        div '.row', ->
          div '.nine.columns', ->
            raw "&nbsp;"
          button '#done.three.columns', disabled: true, "Done"

  wireAdmin: =>
    model = Pylon.get('sessionInfo')

    locker = new Pylon.BV 'lock-down',''
    locker.set
      legend: 'Lock For Home?'
      enabled: true
    Pylon.on 'systemEvent:lock-down:lock-for-home?',()->
      model.set 'lockdownMode', true
      locker.set legend: 'Unlock for Clinic?'
      $('#lock-label').text "Tests run locked down" 

    Pylon.on 'systemEvent:lock-down:unlock-for-clinic?',()->
      model.set 'lockdownMode', false
      locker.set legend: 'Lock For Home?'
      $('#lock-label').text "Tests run unlocked"

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



exports.adminView = new adminView
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
