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
    # save this handheld's ID for logfile upload
    Pylon.handheldID = incoming._id
    # Mongo field _id,__v do not use
    delete incoming._id
    delete incoming.__v
    incoming.clientUnlock = parseInt incoming.clientUnlock,10 if incoming.clientUnlock.match /\./
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
  localStorage['debug'] = handheld.get 'debugString'
  if handheld.get 'loadLogFiles'
    Pylon.accessFileSystem()
  return if Pylon.state.get 'recording'
  if (testID = handheld.get 'testID') and (clientUnlock = handheld.get 'clientUnlock')
    $('#testID').val testID
    p=Pylon.setTheCurrentProtocol testID
    #if the protocol is not a lock-down protocol, the unlock code is erased
    unless p.get 'lockDown'
      localStorage['clientUnlock'] =  ''
      return

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
    Pylon.state.set 'loggedIn',true
    Pylon.trigger "systemEvent:action:record"
    return

  return

module.exports = handheld
