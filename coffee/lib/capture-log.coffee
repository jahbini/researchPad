# vim: et:ts=2:sw=2:sts=2

Backbone = require 'backbone'

logPacket = Backbone.Model.extend
  defaults:
    name: "logfile"
    contents: ""
  idAttribute: 'name'
  initialize: ->
    @set handheld: Pylon.handheldID
    @.xhr = @save()
    return
logItems = Backbone.Collection.extend
  model: logPacket
  url: Pylon.get('hostUrl')+'logfile'

buglog = require '../lib/buglog.coffee'
logger = (introlog= new buglog "capture-log").log

Pylon.accessFileSystem= ()->
  logsForUpload = new logItems
  
  successDir = (entries) ->
    showFile entry for entry in entries
    return

  fail = (error) ->
    logger 'Failed to list directory contents: ', error
    return

  window.resolveLocalFileSystemURL cordova.file.documentsDirectory, (dirEntry) ->
    directoryReader = dirEntry.createReader()
    logger "resolved directory is",dirEntry
    # Get a list of all the entries in the directory
    directoryReader.readEntries successDir, fail
    return

  showFile = (fileEntry)->
    successLoad = (file) ->
      reader = new FileReader()
      reader.onloadend = ()->
        return if this.result == ''
        return unless file.name.match /\.log$/
        logsForUpload.push 
          name: file.name
          contents: this.result
        return

      reader.readAsText(file)
                                                                      
    fileEntry.file successLoad,fail if fileEntry.isFile
    return
  return

