"use strict"

const express    = require('express')
const bodyParser = require('body-parser')
const slack      = require('slack')

const token       = process.env.SLACK_TOKEN
const BOT_TOKEN   = process.env.SLACK_BOT_TOKEN
const OAUTH_TOKEN = process.env.SLACK_OAUTH_TOKEN
const TEAM_NAME   = 'argh' // TODO: get dynamically 


const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))


// Get a list of team members
let members = []
slack.users.list({ token: OAUTH_TOKEN }, (err, data) => {
  members = data.members.filter(user => !user.is_bot)
})


// UTILS
const capitalize = string =>
  string[0].toUpperCase() + string.slice(1)

const verifyWebhook = body => {
  if (!body || body.token !== token) {
    let error = new Error('Invalid credentials')
    error.code = 401
    throw error
  }
}

const tokenize = text => {
  let tokens  = text.split(' ')
  let count   = tokens[0]
  let channel = tokens[1] || ''
    
  return {
    count: count,
    channel: channel.replace(/#/g, '')
  }
}




// MODELS

const quote = (text, channel, author, ts) => {
  return { 
    author_name: author.name,
    text: text,
    mrkdwn_in:true,
    author_link: `https://${TEAM_NAME}.slack.com/team/${author.name}`,
    author_icon: author.profile.image_48,
    footer: `Posted in <#${channel.name}>`,
    ts: ts
  }
  
}

const drawButtons = (action, value) => [
    {
      name: 'action_confirm',
      text: capitalize(action),
      type: 'button',
      value: value,
      style: 'danger'
    },
    {
      name: 'action_confirm',
      text: 'Cancel',
      type: 'button',
      value: ''
    }
  ]

const question = (action, value) => {   
     return {
          text: `Are you sure?`,
          callback_id: `${action}_action`,
          color: '#3AA3E3',
          attachment_type: 'default',
          footer: value ? null : `✅ ${capitalize(action)}` ,
          actions: value ? drawButtons(action, value) : null
      }
}




// expect(question('clean', '5 #fiverr').actions).toBeTruthy()
// expect(question('clean', '5 #fiverr').footer).toBeFalsy()
// expect(question('clean').actions).toBeFalsy()
// expect(question('clean').footer).toBeTruthy()

const currentAction = (action, count, channel) => {
      if (action === 'clean') {
        return `OKAY! Cleaning last ${count} messages.`
      }
      return `OKAY! Moving last ${count} messages to channel #${channel}.`
}


// ACTIONS

const cleanMessages = (count, channel) => {
  slack.channels.history({token: OAUTH_TOKEN, channel:channel, count:parseInt(count)+1}, (err, data) => 
    data.messages.map(msg => delMessage(msg.ts, channel))
  )
}
    
const delMessage = (ts, channel) => {
    slack.chat.delete({token:OAUTH_TOKEN, ts:ts, channel:channel}, (err, data) => { 
      console.log(data)
    })
}

const quoteMessage = (ts, text, channelFrom, channelToId, author, callback) => {
    slack.chat.postMessage({token: BOT_TOKEN, channel:channelToId, text:'', 
                            attachments:[quote(text, channelFrom, author, ts)]}, (err, data) => {
      // console.log('-------------')
      // console.log(channelFrom)
      // console.log(channelToId)
        // return data ? callback(ts, channelFrom.id) : null
    })
}

const askQuestion = (action, channelFromId, channelToName, count, response) => {
    slack.chat.postMessage({token: BOT_TOKEN, channel:channelFromId, text:'', 
                            attachments:[question(action, `${count} ${channelToName}`)]}, (err, data) => {
      console.log(channelToName)
        return data ? response.send(currentAction(action, count, channelToName)) : null
    })
}

const answerQuestion = (action, ts, channelFromId, channelToId, count, callback) => 
    slack.chat.update({token: BOT_TOKEN, ts:ts, channel:channelFromId, text:'', 
                       attachments:[question(action)]}, (err, data) => {
        return data ? setTimeout(() => callback(count, channelFromId, channelToId), 1000) : null
    })

const moveMessages = (count, channelFromId, channelToName) =>   
  slack.channels.history({token: OAUTH_TOKEN, channel:channelFromId, count:count}, (err, historyData) => { // Get messages list
    
    let channelFrom = {}
    let channelToId = ''
    let channels = []
    slack.channels.list({token: OAUTH_TOKEN}, (err, data) => {  // Get channels list
      
      channels = data.channels     
      channelFrom = channels.filter(channel => { // Get channelFrom object
        return channel.id === channelFromId
      })[0]
      channelToId = channels.filter(channel => { // Get channelToId object
        return channel.name === channelToName
      })[0].id
      // console.log('From: '+ channelFrom.name)
      // console.log('To: '+ channelToId)
            
      historyData.messages.map(msg => { // Iterate over messages list that is returned earlier

        let author = members.filter(member => {  // Get the author of current message
          return member.id === msg.user // TODO: Error if BOT
        })[0]
        // console.log(channelFrom)
        // console.log(msg)
        //
      //ts, text, channelFromId, channelToId, author, callback

        // 1. Delete last message from bot (or ignore)
        // 2. Start to quote/delete messages
        // 3. Move bot messages as well???
        
        quoteMessage(msg.ts, msg.text, channelFrom, channelToId, author, delMessage)
      })
      
    })
 })




const dispatcher = (answer, action) => {
  switch (answer.callback_id) {
    case 'clean_action':
      answerQuestion('clean', answer.message_ts, answer.channel.id, action.channelTo, action.count, cleanMessages)
      break
    case 'move_action':
      answerQuestion('move', answer.message_ts, answer.channel.id, action.channelTo, action.count, moveMessages)
      break
    default :
      return null
  }
}

// ROUTES

// app.use('/api', require('api'))

app.post('/api/move', (request, response) => {
  verifyWebhook(request.body)
  
  let channel = request.body.channel_id
  let opt = tokenize(request.body.text)
  
  askQuestion('move', channel, opt.channel, opt.count, response)
  })

app.post('/api/clean', (request, response) => {
  verifyWebhook(request.body)
  
  let channel = request.body.channel_id
  let opt = tokenize(request.body.text)

  askQuestion('clean', channel, opt.channel, opt.count, response)
  })

app.post('/api/request', (request, response) => {
  let answer = JSON.parse(request.body.payload)
  verifyWebhook(answer)
  
  if (answer.actions[0].value) {
    response.sendStatus(200)
    let value = tokenize(answer.actions[0].value)
    dispatcher(answer, {count:value.count, channelTo: value.channel})
  } else {
    response.send('Cancelled')
  }
})

app.get('/api/status', (req, res) =>{
  res.json({ available: true })
})



// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(404)
})

// error handler
// no stacktraces leaked to user on production
app.use((err, req, res, next) => {
  if (err === 404) {
      err = new Error('Not Found')
      err.status = 404
  }
  if (err === 401) {
      err = new Error('Not Authorized')
      err.status = 401
  }
  res.status(err.status || 500)

  // development error handler
  // will print stacktrace
  if (app.get('env') === 'development') {
    console.trace()
    // console.error(err.stack)
    res.json({
        success: false,
        message: err.name || err.message,
        error: err.status || 500,
        stack: err.stack
    })

  } else {
    res.json({
      success: false,
      message: err.name || err.message
    })
  }
})

module.exports = app