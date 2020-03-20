jsondir = require 'jsondir'
Backbone=require 'backbone'
Mailer= require 'nodemailer'
YAML = require 'yamljs'

transporter = Mailer.createTransport
  host: "box.cambodianbamboostudies.com"
  port: 587
  #secure: "STARTTLS"
  secure: false
  auth:
    user: "jim@cambodianbamboostudies.com"
    pass: "Tqbfj0tlD"


csvOrder = 'clinicName,clientName,beginDateLocal,beginTimeLocal,protocolName,walkTime,accepted,endTimeLocal'

name2str = (struct)->
  return struct.first.trim()+" "+struct.last.trim()

Session = Backbone.Model.extend
  EmailContent:(length)->
    salutation: "Greetings #{@.get 'clinicianName'} at #{@.get 'clinicName'}, TEST ONLY - times are Phnom Penh local, please forward with desired edits to jahbini@icloud.com"
    toAddress: @.get 'clinicianEmail'
    ccAddresses: @.get 'eMailCarbon'
    subject: "You have run #{length}  protocols. Please check enclosure contents."
    csvContents: [csvOrder]
    body: []


Sessions = Backbone.Collection.extend
  model: Session

sessions = new Sessions()

makeEmails = (err,allSessions)->
  if err
    console.log "Error in session Directory",err
    process.exit 1
  for clinicName,clinicians of allSessions
    continue if clinicName[0]=='-'
    for clinicianName, clients of clinicians
      continue if clinicianName[0]=='-'
      for clientName,sessionsData of clients
        continue if clientName[0]=='-'
        for sessionDate, boilerPlate of sessionsData
          continue if sessionDate[0]=='-'
          try
            content = JSON.parse boilerPlate['session.json']['-content']
          catch e
            continue
          console.log YAML.stringify content
          continue unless content.beginTime
          if content.duration == -1
            walkTime = 'NA'
          else
            if content.duration == 0
              walkTime = '---'
            else
              walktime = (0.001*content.duration).toFixed 3
          sessions.add 
            clinicianName: name2str content.clinicianName
            clinicianEmail: content.clinicianEmail
            eMailCarbon: content.eMailCarbon
            clinicName: content.clinicName
            clientName: name2str content.clientName
            sessionDate: content.sessionDate
            walkTime: walkTime
            protocolName: content.protocolName
            beginTime: content.beginTime
            beginTimeLocal:content.beginTimeLocal
            beginDateLocal:content.beginDateLocal
            endTime: content.endTime
            endTimeLocal: content.endTimeLocal
            accepted: content.accepted
  console.log "READY TO MAIL"
  for clinician, sessionsData of sessions.groupBy 'clinicianName'
    console.log clinician
    emailContent=null
    for session in sessionsData
      continue unless session
      console.log YAML.stringify clinician: clinician, data:session.toJSON()
      emailContent=session.EmailContent(sessionsData.length) unless emailContent
      s = session.pick 'beginDateLocal','beginTimeLocal','endTimeLocal','beginTime','walkTime','clinicName','clientName','protocolName','accepted'
      console.log s
      body = "At #{s.beginTimeLocal} you #{if s.accepted then 'accepted' else 'rejected'} when #{s.clientName} did #{s.protocolName} #{if s.walkTime != 'NA' then ' in '+s.walkTime+ ' seconds' else ''}"
      emailContent.body.push body
      emailContent.csvContents.push (for key in csvOrder.split ','
        session.get key).join ','
    emailSpec = 
      from: "jim@cambodianbamboostudies.com"
      to: "jimhinds@nia.edu.kh"
      #to: emailContent.toAddress
      #cc: emailContent.ccAddresses
      subject: emailContent.subject
      text: """#{emailContent.salutation}
#{emailContent.body.join "\n"}
That's all\n
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
jsondir.dir2json 'sessions',makeEmails
