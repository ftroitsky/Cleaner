const express    = require('express')
const bodyParser = require('body-parser')
const slack      = require('slack')
const app        = express()

const token  = process.env.SLACK_TOKEN
const btoken = process.env.SLACK_BOT_TOKEN
const otoken = process.env.SLACK_OAUTH_TOKEN
const team   = 'argh' // TODO: get dynamically 

app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json())


// Get a list of team members

let members = []
slack.users.list({token: otoken}, (err, data) => {
  members = data.members.filter(user => {
    return !user.is_bot
  })
})


// UTILS

const verifyWebhook = body => {
  if (!body || body.token !== token) {
    let error = new Error('Invalid credentials')
    error.code = 401
    throw error
  }
}

const tokenize = text => {
  let tokens  = text.split(" ")
  let count   = tokens[0]
  let channel = tokens[1] || ""
    
  return {
    count: count,
    channel: channel.replace(/#/g, '')
  }
}


// ACTIONS

const cleanMessages = (token, count, channel) => 
  slack.channels.history({token:token, channel:channel, count:count}, (err, data) => 
    data.messages.map(msg => delMessage(token, msg.ts, channel))
  )
    

const delMessage = (token, ts, channel) => 
    slack.chat.delete({token:token, ts:ts, channel:channel}, (err, data) => { 
      console.log(data)
    })

const quoteMessage = (token, btoken, ts, text, channelToId, channelFrom, author, callback) => 
    slack.chat.postMessage({token:btoken, channel:channelToId, text:'', attachments:[attach(text, channelFrom, author, ts)]}, (err, data) => {
      data ? callback(token, ts, channelFrom.id) : null
    })

const askQuestion = (text, channelId, count, response) => 
    slack.chat.postMessage({token:btoken, channel:channelId, text:'', attachments:[
     {
            "text": text,
            "callback_id": "clean_action",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "clean_action_approve",
                    "text": "Delete",
                    "type": "button",
                    "value": count + ' ' + channelId,
                    "style": "danger"
                },
                {
                    "name": "clean_action_approve",
                    "text": "Cancel",
                    "type": "button",
                    "value": ""
                }
            ]
        }
    ]}, (err, data) => {
      return data ? response.send('OKAY! Cleaning last ' + count + ' messages.') : null
    })

const answerQuestion = (text, channelId, count, callback) => 
    slack.chat.postMessage({token:btoken, channel:channelId, text:'', attachments:[
     {
            "text": text,
            "callback_id": "clean_action",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "footer":'✅ Delete'
        }
    ]}, (err, data) => {
      return data ? callback(otoken, parseInt(count)+2, channelId) : null
    })


const moveMessages = (token, btoken, count, channelFromId, channelToId) =>   
  slack.channels.history({token:token, channel:channelFromId, count:count}, (err, historyData) => { // Get messages list
    
    let channelFrom = {}
    let channels = []
    slack.channels.list({token:token}, (err, data) => {  // Get channels list
      
      channels = data.channels     
      channelFrom = channels.filter(channel => { // Get channelFrom object
        return channel.id === channelFromId
      })[0]
            
      historyData.messages.map(msg => { // Iterate over messages list that is returned earlier

        let author = members.filter(member => {  // Get the author of current message
          return member.id === msg.user
        })[0]
      
        quoteMessage(token, btoken, msg.ts, msg.text, channelToId, channelFrom, author, delMessage)
      })
      
    })
 })

const attach = (text, channel, author, ts) => {
  return { 
    author_name: author.name,
    text: text,
    mrkdwn_in:true,
    author_link: `https://${team}.slack.com/team/${author.name}`,
    author_icon: author.profile.image_48,
    footer: "Posted in #" + channel.name,
    ts: ts
  }
  
}


// ROUTES

app.post("/api/move", (request, response) => {
  verifyWebhook(request.body)
  
  let channel = request.body.channel_id
  let opt = tokenize(request.body.text)
  
  moveMessages(otoken, btoken, opt.count, channel, opt.channel)
  
  response.send('OKAY! Moving last ' + opt.count + ' messages to ' + opt.channel + ' channel.')
})


app.post("/api/clean", (request, response) => {
  verifyWebhook(request.body)
  
  let channel = request.body.channel_id
  let opt = tokenize(request.body.text)

  askQuestion('Are you sure?', channel, opt.count, response)
  })


// app.get("/api/users", (request, response) => {
//     response.send(members)
// })

const dispatcher = (action_id, response, action) => {
  switch (action_id) {
    case 'clean_action' :
      answerQuestion('Are you sure?', action.channel, action.count, cleanMessages)
    default :
      return response.send('Cancelled')
  }
}


app.post('/api/request', (request, response) => {
  let answer = JSON.parse(request.body.payload)
  verifyWebhook(answer)
  response.sendStatus(200)
  // console.log(JSON.parse(request.body.payload))
    
  // response.send(JSON.parse(request.body.payload).actions[0].value)
  let value = tokenize(answer.actions[0].value)
  dispatcher(answer.callback_id, response, {count:value.count, channel: value.channel})
})

// SERVER
const listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
