var mongoose = require('mongoose')
var request = require('then-request')
var systemCollection = null
var runningDirectors = []
var processedItems = 0
var systemCount = 0

function findRunningDirectors (callback) {
  request('GET',
    process.env.RANCHER_STACKS_URL + '?name_prefix=director', 
    {
      headers: {
        'Authorization': 'Basic ' + new Buffer(process.env.RANCHER_USER + ':' + process.env.RANCHER_KEY).toString('base64')
      }
    }).done(function (res) {
      JSON.parse(res.getBody()).data.forEach(function (item, i, arr) {
        runningDirectors.push(item.name)
      })
      console.log(runningDirectors)
      callback();
  });
}

function findAllDirectors () {
  systemCollection.count(function (err, countResult){
    if (err) {
      console.error(err.message)
    }
    if (countResult){
      systemCount = countResult
      systemCollection.find({}, function (err, findResult) {
        if (err) {
          console.error(err.message)
        }
        if (findResult) {
          findResult.forEach(function(result) {
            console.log('Found system ' + result.systemId)
            if(runningDirectors.indexOf('director-' + result.systemId) === -1) {
              tryStartingStack(result.systemId)
            }else{
              processedItems++
              if(processedItems === systemCount){
                process.exit(0)
              }
            }
          })
        } else {
          console.error('[mongo]', 'No system ids')
          process.exit(1)
        }
      })
    }
  })
}

function tryStartingStack (systemId) {
  console.log('Trying to start stack ' + systemId )
  request('POST',
    process.env.RANCHER_STACKS_URL, 
    {
      headers: {
        'Authorization': 'Basic ' + new Buffer(process.env.RANCHER_USER + ':' + process.env.RANCHER_KEY).toString('base64')
      },
      body: '{"name": "director-' + systemId + '","system": false,"dockerCompose": "version: \'2\'\\r\\nservices:\\r\\n  director:\\r\\n    image: registry.gitlab.com/rutt/director\\r\\n    environment:\\r\\n      ACTION_SCRIPTER_URL: ' + process.env.ACTION_SCRIPTER_URL + '\\r\\n      AMQP_URL: ' + process.env.AMQP_URL + '\\r\\n      LOGGER_URL: ' + process.env.LOGGER_URL + '\\r\\n      MONGO_URL: ' + process.env.MONGO_URL + '\\r\\n      SPLITTER_URL: ' + process.env.SPLITTER_URL + '\\r\\n      SYSTEM_ID: ' + systemId + '\\r\\n    external_links:\\r\\n    - mongo/mongo-cluster:mongo\\r\\n    - rutt-base/splitter:splitter\\r\\n    - rutt-base/logger:logger\\r\\n    - rutt-base/action-scripter:action-scripter","rancherCompose": "","startOnCreate": true,"binding": null}'
    }).done(function (res) {
      processedItems++
      if(processedItems === systemCount){
        process.exit(0)
      }
  });
}

function start () {
  mongoose.connect(process.env.MONGO_URL, function (err) {
    if (err) {
      console.error('[mongo]', err.message)
    }

    systemCollection = mongoose.connection.db.collection('systems')
    findRunningDirectors(findAllDirectors)
  })
}

start()
