# vim: et:ts=2:sw=2:sts=2
buglog = require './buglog.coffee'
sanitylogger = (sanitylog= new buglog "sanity").log
stats = require './statistics.coffee'


module.exports = class sanity
  clear:()->
    @gyro[0].clear()
    @gyro[1].clear()
    @gyro[2].clear()
    @accel[0].clear()
    @accel[1].clear()
    @accel[2].clear()
    @mag[0].clear()
    @mag[1].clear()
    @mag[2].clear()
    return
  observe: (gyro,accel,mag,sequence,startTime)=>
    if @oldEndTime
      @timer.push @oldEndTime-@oldStartTime
    if @sequence<sequence
      @sequencer.push sequence-@sequence  
    @sequence = sequence
    @gyro[0].push gyro[0]
    @gyro[1].push gyro[1]
    @gyro[2].push gyro[2]
    
    @accel[0].push accel[0]
    @accel[1].push accel[1]
    @accel[2].push accel[2]
    
    @mag[0].push mag[0]
    @mag[1].push mag[1]
    @mag[2].push mag[2]
    @oldStartTime = startTime
    @oldEndTime = Date.now()
    return
  format = (v) ->
    v.mean().toFixed(2)
  judge: ()=>
    report = {
      accel: @accel.map (v)-> v.allValues()
      mag: @mag.map (v)-> v.allValues()
      gyro: @gyro.map (v)-> v.allValues()
      rate: @timer.allValues()
      sequence: @sequencer.allValues()
    }
    Pylon.trigger 'sanityReport',report
    sanitylogger "sequence number of #{@role} is #{@sequence}"
    @clear()
    return

  constructor: (@role) ->
    @sequence = 10000000
    @timer = new stats "timer"
    @sequencer = new stats "upCount"
    
    @accel =[
      new stats "#{@role} accel x"
      new stats "#{@role} accel y"
      new stats "#{@role} accel z"
      ]
    @mag = [
      new stats "#{@role} mag x"
      new stats "#{@role} mag y"
      new stats "#{@role} mag z"
      ]
    @gyro = [
      new stats "#{@role} gyro x"
      new stats "#{@role} gyro y"
      new stats "#{@role} gyro z"
      ]
    return
