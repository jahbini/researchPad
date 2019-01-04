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
    keepGoing = true
    while keepGoing
      thisOne = c[ Math.floor Math.random()*(c.length)]
      keepGoing = thisOne == notThis
      keepGoing |= thisOne == orThis
    return thisOne

  order:(icon)->
    @.attributes.order[icon]
    
protocolCollection = Backbone.Collection.extend
  model: protocol
  url: Pylon.get('hostUrl')+'protocols'

module.exports = new protocolCollection
###
#  From keystone
name: "unknown"
comments: "Default test"
sensorsNeeded: 0
showLeadIn: false
leadInDuration: 0
showPractice: false
practiceDuration: 0
testDuration: 10000 # show test /error message for ten seconds
mileStonesAreProtocols: false
suppressInDropDown: true
showMileStones: true
mileStoneText: "Bad name speccified in test sequencing"
mileStones: "😵,😵"
#Protocol.add
  name:
    type: Types.Text
    required: true
    index: true
    unique: true
    default: "Other"
  comments: type: Types.Text
  sensorsNeeded: type: Types.Number , default: 0

  showLeadIn: type: Types.Boolean, default: false
  leadInDuration: type: Types.Number, default: 5

  showPractice: type: Types.Boolean, default: false
  practiceDuration: type: Types.Number, default:5

  testDuration: type: Types.Number, default:0

  mileStonesAreProtocols: type: Types.Boolean, default: false
  suppressInDropDown: type: Types.Boolean, default: false
  showMileStones: type: Types.Boolean, default: false
  mileStoneText: type:Types.Text, default: "The test"

  mileStones:
    type: Types.Text
    default: ""
###
