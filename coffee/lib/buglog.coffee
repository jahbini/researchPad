# vim: et:ts=2:sw=2:sts=2

logger = require 'debug'
c=window.Console
require('./console')
localConsole = window.Console
window.Console = c

module.exports = class buglog

  constructor: (nameSpace) ->
    queue = []
    @yourLogger = new logger(nameSpace)
    #   @yourLogger.enabled = true
    logger.formatters.j = require  'json-stringify-safe'
    @yourLogger.useColors = false
    @yourLogger.log = (stuff...)->
      # if DDJSLogger exists (only after Cordova fires deviceReady) then run out queue
      #otherwse we just keep accumulating log requests
      queue.push stuff
      if DDJSLogger? && Pylon.console
        queue.map (stuff)->
          DDJSLogger.logio stuff
          Pylon.console.log.apply Pylon.console, stuff
        queue=[]
      else
      localConsole.log stuff
    return
  
  log: ()=>
    @yourLogger.apply @this,arguments
  
  useDiv: (divID)->
    Pylon.console = new localConsole divID,Pylon
