# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data

window.$ = $ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
# the configuration model is instantiated
# from the host as a collection of one. A singleton
# we update the Pylon default values at that time
ConfigurationModel = Backbone.Model.extend
  initialize:()->
    Pylon.unlock = @.attributes.unlock
    Pylon.loginPassword = @.attributes.loginPassword
    return

ConfigurationCollection = Backbone.Collection.extend
  model: ConfigurationModel
  url: Pylon.get('hostUrl')+'configs'

#set default values if the host is not there when we ask
Pylon.unlock = '6180339'
Pylon.loginPassword =  'retro2017'
module.exports = new ConfigurationCollection
