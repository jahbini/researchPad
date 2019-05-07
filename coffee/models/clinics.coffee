# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# clinic model and clinics collection

window.$ = $ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
clinicModel = Backbone.Model.extend
  idAttribute: '_id'

clinicCollection = Backbone.Collection.extend
  model: clinicModel
  url: Pylon.get('hostUrl')+'clinics'

module.exports = new clinicCollection
