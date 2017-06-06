# vim: et:ts=2:sw=2:sts=2
buglog = require './buglog.coffee'
pipelinelogger = (pipelinelog= new buglog "statistics").log


module.exports = class statistics

  clear: () ->
    @N = 0
    @M1 = @M2 = @M3 = @M4 = 0
    @max = -66000
    @min = 66000
    return
  name: ()->
    return @whoAmI
    
  constructor: (@whoAmI) ->
    @clear()
    
  push: (x)->
    @max = x if @max<x
    @min = x if @min>x
    oldn = @N++
    n = @N
    delta = x-@M1
    delta_n = delta/n
    delta_n2 = delta_n*delta_n
    term1 = delta*delta_n*oldn
    @M1 += delta_n
    @M4 += term1*delta_n2*(n*n-3*n+3)+6*delta_n2*@M2-4*delta_n*@M3
    @M3 += term1*delta_n*(n-2)-3*delta_n*@M2
    @M2 += term1
    return 
  allValues: ()->
    return JSON.stringify {
      n: @N
      name: @name()
      min: @min
      max: @max
      mean: @M1.toFixed(2)+0
      standardDeviation: @standardDeviation().toFixed(2)+0
      variance: @variance().toFixed(2)+0
      skewness: @skewness().toFixed(2)+0
      kurtiosis: @kurtiosis().toFixed(2)+0
    }
  numDataValues: ()->
    return @N
  mean: ()->
    return @M1
  variance: ()->
    return @M2/(@N-1)
  standardDeviation: ()->
    return Math.sqrt @variance()
  skewness: ()->
    return Math.sqrt(@N)*@M3/Math.pow(@M2,1.5) 
  kurtiosis: ()->
    return @N*@M4/(@M2*@M2)-3
    
  maximum: ()->
    return @max
  minimum: ()->
    return @min
    
