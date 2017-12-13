var mongoose = require('mongoose')
var request = require('then-request')
var systemCollection = null
var runningDirectors = []

function findRunningDirectors (callback) {
  request('GET',
    process.env.RANCHER_STACKS_URL + '/stacks?name_prefix=director', 
    {
      headers: {
        'Authorization': new Buffer(process.env.RANCHER_USER + ':' + process.env.RANCHER_KEY).toString('base64')
      }
    }).done(function (res) {
      res.data.forEach(function (item, i, arr) {
        runningDirectors.push(item.name)
      })
      callback();
  });
}

function findAllDirectors () {
  systemCollection.find({}, function (err, result) {
    if (err) {
      console.error(err.message)
    }
    if (result) {
      if(runningDirectors.indexOf('director-' + result.systemId) == -1) {
        tryStartingStack(result.systemId)
      }
    } else {
      console.error('[mongo]', 'No system ids')
      process.exit(1)
    }
  })
}

function tryStartingStack (systemId) {
  request('POST',
    process.env.RANCHER_STACKS_URL + '?name_prefix=director', 
    {
      headers: {
        'Authorization': new Buffer(process.env.RANCHER_USER + ':' + process.env.RANCHER_KEY).toString('base64')
      },
      body: '{"name": "director-' + systemId + '","system": false,"dockerCompose": "version: \'2\'\\r\\nservices:\\r\\n  director:\\r\\n    image: registry.gitlab.com/rutt/director\\r\\n    environment:\\r\\n      ACTION_SCRIPTER_URL: ' + process.env.ACTION_SCRIPTER_URL + '\\r\\n      AMQP_URL: ' + process.env.AMQP_URL + '\\r\\n      LOGGER_URL: ' + process.env.LOGGER_URL + '\\r\\n      MONGO_URL: ' + process.env.MONGO_URL + '\\r\\n      SPLITTER_URL: ' + process.env.SPLITTER_URL + '\\r\\n      SYSTEM_ID: ' + systemId + '\\r\\n    external_links:\\r\\n    - mongo/mongo-cluster:mongo\\r\\n    - rutt-base/splitter:splitter\\r\\n    - rutt-base/logger:logger\\r\\n    - rutt-base/action-scripter:action-scripter","rancherCompose": "","startOnCreate": true,"binding": null}'
    }).done(function (res) {
      console.log(res.getBody());
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
