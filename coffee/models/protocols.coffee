# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# protocols

_ = require('underscore')
Backbone = require ('backbone')

#
protocol = Backbone.Model.extend
  defaults:
    name: "Other"
    comments: "Other"
    mileStones: "initiation,completion"
protocolCollection = Backbone.Collection.extend
  model: protocol
  url: Pylon.get('hostUrl')+'protocols'

module.exports = new protocolCollection
