jsondir = require 'jsondir'
Backbone=require 'backbone'
Mailer= require 'nodemailer'

transporter = Mailer.createTransport
  host: "box.cambodianbamboostudies.com"
  port: 587
  #secure: "STARTTLS"
  secure: false
  auth:
    user: "jim@cambodianbamboostudies.com"
    pass: "Tqbfj0tlD"


csvOrder = 'clinicName,clientName,beginTime,protocolName,walkTime,accepted,endTime'

name2str = (struct)->
  return struct.first.trim()+" "+struct.last.trim()

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
    salutation: "Greetings #{@.get 'clinicianName'} at #{@.get 'clinicName'},"
    toAddress: @.get 'clinicianEmail'
    ccAddresses: @.get 'eMailCarbon'
    subject: "You have run #{length}  protocols. Please check enclosure contents."
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
          console.log boilerPlate
          try
            content = JSON.parse boilerPlate['session.json']['-content']
          catch e
            continue
          {accepted,beginTime,endTime,clinicianEmail,protocolName,clinicianName,clientName,clinicName,eMailCarbon} = content
          console.log content
          continue unless beginTime
          letters.add 
            clinicianName: name2str clinicianName
            clinicianEmail: clinicianEmail
            eMailCarbon: eMailCarbon
            clinicName: clinicName
            clientName: name2str clientName
            sessionDate: sessionDate
            walkTime: if content.duration then (0.001*content.duration).toFixed 3 else '---'
            protocolName: protocolName
            beginTime: beginTime
            endTime: endTime
            accepted: accepted

  for clinician, sessions of letters.groupBy 'clinicianName'
    console.log clinician
    emailContent=null
    for session in sessions
      emailContent=session.EmailContent(sessions.length) unless emailContent
      s = session.pick 'beginTime','walkTime','clinicName','clientName','protocolName','accepted'
      body = "On #{humanizeTime s.beginTime} you #{if s.accepted then 'accepted' else 'rejected'} when #{s.clientName} did #{s.protocolName} #{if s.walkTime != '---' then ' in '+s.walkTime+ ' seconds' else if s.protocolName.match /nosensors/i then ' walktime not recorded' else ''}"
      emailContent.body.push body
      emailContent.csvContents.push (for key in csvOrder.split ','
        session.get key).join ','
    emailSpec = 
      from: "jim@cambodianbamboostudies.com"
      to: emailContent.toAddress
      cc: emailContent.ccAddresses
      subject: emailContent.subject
      text: """#{emailContent.salutation}
#{emailContent.body.join "\n"}
That's all
"""
      attachments:
        filename: "session.csv"
        contentType: "text/csv"
        content: emailContent.csvContents.join '\n'

    transporter.sendMail emailSpec, (err,data)->
      console.log "err is",err
      console.log "data from is",data

    #console.log emailContent

  #console.log "Thats' all"
  #return
sessions= jsondir.dir2json 'sessions',makeEmails
