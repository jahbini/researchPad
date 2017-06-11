# vim: et:ts=2:sw=2:sts=2
buglog = require './buglog.coffee'
pipelinelogger = (pipelinelog= new buglog "statistics").log


module.exports = class statistics

  clear: () ->
    @N = 0
    @crowd = 0
    @M1 = @M2 = @M3 = @M4 = 0
    @max = 0
    @nmin = 0
    @nmax = 0
    @min = 0
    return
  name: ()->
    return @whoAmI
    
  constructor: (@whoAmI) ->
    @clear()
    
  push: (x)->
    @nmax = 0 if @max<x
    @max =x if @nmax==0
    @nmax++ if @max==x
    
    @nmin = 0 if @min>x
    @min = x if @nmin==0
    @nmin++ if @min==x
    
    @crowd = (@crowd*4+x)/5
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
    return {
      name: @name()
      n: @N
      min: @min
      nmin: @nmin
      max: @max
      nmax: @nmax
      mean: @M1.toFixed(2)+0
      standardDeviation: @standardDeviation().toFixed(2)+0
      #variance: @variance().toFixed(2)+0
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
  nmin: ()->
    return @nmin
  nmax: ()->
    return @nmax
  percent: ()->
    return 0 unless @max > @min
    return 100*(@mean()-@min)/(@max-@min)
  decay: ()->
    return @M1 unless @max > @min
    return 100*(@crowd-@min)/(@max-@min)
    
