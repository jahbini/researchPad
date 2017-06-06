# vim: et:ts=2:sw=2:sts=2
buglog = require './buglog.coffee'
sanitylogger = (sanitylog= new buglog "sanity").log
stats = require './statistics.coffee'


module.exports = class sanity

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
    sanitylogger "sequence number of #{@role} is #{@sequence}"
    
    sanitylogger @timer.allValues()
    sanitylogger @sequencer.allValues()


    sanitylogger @accel[0].allValues()
    sanitylogger @accel[1].allValues()
    sanitylogger @accel[2].allValues()

    sanitylogger @mag[0].allValues()
    sanitylogger @mag[1].allValues()
    sanitylogger @mag[2].allValues()
    
    sanitylogger @gyro[0].allValues()
    sanitylogger @gyro[1].allValues()
    sanitylogger @gyro[2].allValues()
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
