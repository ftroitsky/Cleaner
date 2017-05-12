"use strict"

const express    = require('express')
const bodyParser = require('body-parser')


const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use('/api/', require('./api'))


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