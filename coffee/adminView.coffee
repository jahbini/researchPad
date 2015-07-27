# vim: et:ts=2:sw=2:sts=2:nowrap

$=require('jquery')
Backbone = require('Backbone')
Teacup = require('teacup')

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
      #render the clinic drop down list -- if the server is responding
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
        return @
      events:
        'click':  ->
          Pylon.trigger('adminDone')
          return false
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



exports.adminView = new adminView
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
