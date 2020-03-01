# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
rawSession = Backbone.Model.extend {
  idAttribute: '_id'
  url: Pylon.get('hostUrl')+'session'
  getEventPath: ()->
    return "#{@rawPath}/event#{@.eventCounter++}.json"
  rawPath:""
  initialize: ()->
    # clear out the subprotocol of a suite of tests
    @on 'change:testID',()->
      Pylon.setTheCurrentProtocol null
      if @.attributes.testID
        debugger
        @.eventCounter = 0
        clinicName = sessionInfo.get('clinic').get 'name'
        clinician = sessionInfo.get('clinician')
        clinicianName= Pylon.get('clinicians').findWhere({ _id: clinician }).get('name');
        client = sessionInfo.get('client')
        clientName= Pylon.get('clients').findWhere({ _id: client }).get('name');
        @rawPath= "#{clinicName}/#{clinicianName.first} #{clinicianName.last}/#{clientName.first} #{clientName.last}/#{Date.now()}".replace(/ +/g,'_').toLowerCase()
        @set 'path', "#{@rawPath}/session.json"
      return
}

sessionInfo = new rawSession
  clinic: ''
  testID: ''
  lockdownMode: false
  leftSensorUUID: ''
  rightSensorUUID: ''
  platformIosVersion: ''
  applicationVersion: ''

module.exports = sessionInfo
