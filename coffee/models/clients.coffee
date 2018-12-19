# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

window.$ = $ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
# #Clients --
clientModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    patientOnly: 'Boolean'
clientCollection = Backbone.Collection.extend
  model: clientModel
module.exports = clients = new clientCollection
