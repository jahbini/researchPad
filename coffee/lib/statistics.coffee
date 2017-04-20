# vim: et:ts=2:sw=2:sts=2
buglog = require './buglog.coffee'
pipelinelogger = (pipelinelog= new buglog "statistics").log


module.exports = class statistics

  clear: () ->
    @N = 0
    @M1 = @M2 = @M3 = @M4 = 0
    return

  constructor: () ->
    clear()
  push: (x)->
    oldn = @N++
    n = @N
    delta = x - @M1
    delta_n = delta / n
    delta_n2 = delta_n * delta_n
    term1 = delta * delta_n * oldn
    @M1 += delta_n
    @M4 += term1 * delta_n2 * (n * n - 3* n + 3) + 6 * delta_n2 * @M2 - 4 * delta_n * @M3
    @M3 += term1 * delta_n * (n - 2) - 3 * delta_n * @M2
    @M2 += term1
    return 
  numDataValues: ()->
    return @N
  mean: ()->
    return @M1
  variance: ()->
    return @M2/(@N-1)
  standardDeviation: ()->
    return MATH.sqrt @variance()
  skewness: ()->
    return MATH.sqrt(@N) * @M3 /MATH.pow(@M2,1.5) 
  kurtiosis: ()->
    return @N*@M4 / (@M2*@M2) -3
    
