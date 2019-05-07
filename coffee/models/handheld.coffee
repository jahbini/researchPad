# stagapp
# vim: et:ts=2:sw=2:sts=2
#

###
# set up information regarding the specific device
# and switch from web onclick to app touchstart
# web access does not generate touch info, so buttons get onclick
###

Backbone = require ('backbone')
Handheld = Backbone.Model.extend {
  idAttribute: '_id'
  urlRoot: Pylon.get('hostUrl')+'handheld'
}
handheld = new Handheld()
sessionInfo = Pylon.sessionInfo
handheld.save
  platformUUID: sessionInfo.get 'platformUUID'
  platformIosVersion: sessionInfo.get 'platformIosVersion'
  applicationVersion: sessionInfo.get 'applicationVersion'

Pylon.on 'adminDone', ->  # what other values need to be transferred?
  {clinic,clinician,client,password} = sessionInfo.attributes
  debugger
  delete handheld.attributes.__v
  handheld.save {clinic,clinician,client,password},{silent: true}
  return

handheld.on 'change',->
  if (testID = handheld.get 'testID') and (clientUnlock = handheld.get 'clientUnlock')
    $('#testID').val testID
    Pylon.setTheCurrentProtocol testID
    localStorage['clientUnlock'] =  clientUnlock
    localStorage['hash'] =  'Keystone Forced'
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
    Pylon.trigger 'systemEvent:recordCountDown:start'

  return

module.exports = handheld
