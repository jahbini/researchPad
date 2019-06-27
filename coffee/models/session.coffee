# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
rawSession = Backbone.Model.extend {
  idAttribute: '_id'
  url: Pylon.get('hostUrl')+'session'
  initialize: ()->
    # clear out the subprotocol of a suite of tests
    @on 'change:testID',()->
      Pylon.setTheCurrentProtocol null
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
