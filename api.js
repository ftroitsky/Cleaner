"use strict"

const express = require('express')
const router  = express.Router()
const wrap    = require('co-express')

const { verifyWebhook, tokenize, askQuestion, dispatcher } = require('./cleaner')


router.post('/move', wrap(function *(req, res) {
  yield verifyWebhook(req.body)
  
  let channelFromId = req.body.channel_id
  let opt = tokenize(req.body.text)
  console.log('Move', opt)
  console.log(channelFromId)
  
  yield askQuestion('move', channelFromId, opt.channel, opt.count, res)
}))

router.post('/clean', wrap(function *(req, res) {
  yield verifyWebhook(req.body)
  
  let channelId = req.body.channel_id
  let opt = tokenize(req.body.text)

  yield askQuestion('clean', channelId, opt.channel, opt.count, res)
}))

router.post('/request', wrap(function *(req, res) {
  let answer = JSON.parse(req.body.payload)
  console.log('Answer', answer)
  yield verifyWebhook(answer)
  
  if (answer.actions[0].value) {
    console.log('Action', answer.actions[0].value)
    res.sendStatus(200)
    let value = tokenize(answer.actions[0].value)
    dispatcher(answer, { count: value.count, channelTo: value.channel })
  } else {
    res.send('Cancelled')
  }
}))

router.get('/status', (req, res) =>{
  console.log('checking status')
  res.json({ available: true })
})


module.exports = router