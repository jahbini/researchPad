# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# clinician model and collection

Backbone = require ('backbone')
# #Clinicians --
clinicianModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    password: 'Password'
clinicianCollection = Backbone.Collection.extend
  model: clinicianModel
module.exports = new clinicianCollection
