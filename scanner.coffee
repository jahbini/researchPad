jsondir = require 'jsondir'
Backbone=require 'backbone'
csvOrder = 'clinicName,clientName,beginTime,protocolName,duration,endTime'

name2str = (struct)->
  return struct.first+" "+struct.last

humanizeTime=(theTime)->
  sessionLocalTime = new Date()
  sessionLocalTime.setTime theTime
  return sessionLocalTime.toLocaleString()

Session = Backbone.Model.extend
  initialize:()->
    @on 'change:beginTime',(theTime)->
      sessionLocalTime = new Date()
      sessionLocalTime.setTime theTime
      @set startTime: sessionLocalTime.toLocaleString()
      return 
    return @
  EmailContent:(length)->
    salutation: "Greetings #{@.get 'clinicianName'},"
    toAddress: @.get 'clinicianEmail'
    subject: "You have run #{length}  protocols"
    csvContents: [csvOrder]
    body: []


Letters = Backbone.Collection.extend
  model: Session

letters = new Letters()

makeEmails = (err,allSessions)->
  if err
    console.log "Error in session Directory",err
    process.exit 1
  for clinicName,clinicians of allSessions
    continue if clinicName[0]=='-'
    for clinicianName, clients of clinicians
      continue if clinicianName[0]=='-'
      for clientName,sessions of clients
        continue if clientName[0]=='-'
        for sessionDate, boilerPlate of sessions
          continue if sessionDate[0]=='-'
          content = JSON.parse boilerPlate['session.json']['-content']
          {beginTime,endTime,clinicianEmail,protocolName,clinicianName,clientName,clinicName} = content
          console.log content
          continue unless beginTime
          letters.add 
            clinicianName: name2str clinicianName
            clinicianEmail: clinicianEmail
            clinicName: clinicName
            clientName: name2str clientName
            sessionDate: sessionDate
            duration: if content.duration then content.duration else '---'
            protocolName: protocolName
            beginTime: beginTime
            endTime: endTime

  for clinician, sessions of letters.groupBy 'clinicianName'
    console.log clinician
    emailContent=null
    for session in sessions
      emailContent=session.EmailContent(sessions.length) unless emailContent
      s = session.pick 'beginTime','endTime','clinicName','clientName','protocolName'
      body = "On #{humanizeTime s.beginTime} until #{humanizeTime s.endTime}, at #{s.clinicName} #{s.clientName} did #{s.protocolName}"
      emailContent.body.push body
      emailContent.csvContents.push (for key in csvOrder.split ','
        session.get key).join ','
    console.log emailContent



  console.log "Thats' all"
  return
sessions= jsondir.dir2json 'sessions',makeEmails
