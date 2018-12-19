# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# protocols

_ = require('underscore')
Backbone = require ('backbone')

#

shuffle = (a) ->
  for i in [a.length-1..1]
    j = Math.floor Math.random() * (i + 1)
    [a[i], a[j]] = [a[j], a[i]]
  a
protocol = Backbone.Model.extend
  defaults:
    name: "Other"
    comments: "Other"
    mileStones: ["initiation","completion"]
  parse: (attributes)->
    attributes.mileStones = attributes.mileStones.split ','
    attributes
  initialize: ()->

  setCurrentTest:(limit)->
    @attributes.order={}
    @attributes.currentTest = (shuffle (@.attributes.mileStones[..]))[...limit]
    @attributes.order[key]=m for key,m in @attributes.currentTest
    @.attributes.currentTest

  selectFromCurrentTest:(notThis,orThis=notThis)->
    c= @.attributes.currentTest
    thisOne = c[ Math.floor Math.random()*(c.length)]
    while notThis==  thisOne || thisOne == orThis
      thisOne = c[ Math.floor Math.random()*(c.length)]
    return thisOne

  order:(icon)->
    @.attributes.order[icon]
    
protocolCollection = Backbone.Collection.extend
  model: protocol
  url: Pylon.get('hostUrl')+'protocols'

module.exports = new protocolCollection
