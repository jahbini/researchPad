# stagapp
# vim: et:ts=2:sw=2:sts=2
#

###
# set up information regarding the specific device
# and switch from web onclick to app touchstart
# web access does not generate touch info, so buttons get onclick
###

Backbone = require ('backbone')
buglog = require '../lib/buglog.coffee'
handlogger = (introlog= new buglog "hand").log

Handheld = Backbone.Model.extend {
  idAttribute: '_id'
  urlRoot: Pylon.get('hostUrl')+'handheld'
  parse:(incoming)->
    # Mongo field __v not currently in use
    delete incoming.__v
    return incoming

}
handheld = new Handheld()
handlogger "creating handheld structure"
sessionInfo = Pylon.sessionInfo

handheld.save
  platformUUID: sessionInfo.get 'platformUUID'
  platformIosVersion: sessionInfo.get 'platformIosVersion'
  applicationVersion: sessionInfo.get 'applicationVersion'


handheld.on 'change',->
  handlogger "handheld change", handheld.attributes
  # set a reminder for the client
  localStorage['clientUnlockOK'] =  handheld.get 'clientUnlockOK'

  if (testID = handheld.get 'testID') and (clientUnlock = handheld.get 'clientUnlock')
    $('#testID').val testID
    Pylon.setTheCurrentProtocol testID
    localStorage['clientUnlock'] =  clientUnlock
    clinician = handheld.get 'clinician'
    clinic = handheld.get 'clinic'
    client = handheld.get 'client'
    password = handheld.get 'password'
    $('#desiredClinician').val clinician
    $('#desiredClinic').val clinic
    $('#desiredClient').val client
    $('#password').val password
    sessionInfo.unset sessionInfo.idAttribute
    sessionInfo.save {clinic,clinician,password,client,testID}
    handlogger "Setting recording state in handheld:change"
    Pylon.state.set 'recording',false
    Pylon.trigger 'systemEvent:recordCountDown:start'

  return

module.exports = handheld
