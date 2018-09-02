var mongoose = require('mongoose')
var ObjectId = mongoose.Types.ObjectId
let db = {}
let cachedResult = {}
const PromiseProvider = require('./promise_provider')

const promiseOrCallback = function (callback, fn) {
  if (typeof callback === 'function') {
    try {
      return fn(callback)
    } catch (error) {
      return process.nextTick(() => {
        throw error
      })
    }
  }

  const Promise = PromiseProvider.get()

  return new Promise((resolve, reject) => {
    fn(function (error, res) {
      if (error != null) {
        return reject(error)
      }
      if (arguments.length > 2) {
        return resolve(Array.prototype.slice.call(arguments, 1))
      }
      resolve(res)
    })
  })
}

module.exports = function () {
  const models = Object.keys(mongoose.models)

  const populate = (field, callback) => {
    return promiseOrCallback(callback, cb => {
      if (!cachedResult) {
        cb(null, cachedResult)
        return
      }
      const prop = db[cachedResult.schema.obj[field].ref].filter(obj => {
        return obj._id === cachedResult[field]
      })[0]
      cachedResult.company = new mongoose.models[cachedResult.schema.obj[field].ref](prop)
      cb(null, cachedResult)
    })
  }

  const trim = (doc) => {
    Object.keys(doc).forEach(key => {
      if (doc[key] && doc[key].id && typeof doc[key].id === 'string') {
        doc[key] = doc[key].id
      }
    })
    return doc
  }

  models.forEach(model => {
    db[model] = []

    mongoose.models[model].insertMany = (arr, options, callback) => {
      return promiseOrCallback(callback, cb => {
        arr.forEach(doc => {
          db[model].push(doc)
        })
        cb(null, arr)
      })
    }

    mongoose.models[model].create = (doc, callback) => {
      return promiseOrCallback(callback, cb => {
        doc = trim(doc)
        const paths = mongoose.models[model].schema.paths
        Object.keys(paths).forEach(path => {
          if (!doc[path]) {
            if (typeof paths[path].defaultValue === 'function') {
              doc[path] = paths[path].defaultValue()
            } else if (typeof paths[path].defaultValue !== 'undefined') {
              doc[path] = paths[path].defaultValue
            }
          }
        })
        const obj = { ...doc, _id: new ObjectId() }
        const document = new mongoose.models[model](obj)
        const error = document.validateSync()
        if (!error) {
          db[model].push(obj)
          cb(null, document)
        } else {
          cb(error)
        }
      })
    }

    mongoose.models[model].findOne = (doc, callback) => {
      if (doc.constructor.name === 'ObjectID') {
        let result = db[model].find(obj => obj['_id'].equals(doc))
        cachedResult = result && new mongoose.models[model](result)
      } else {
        doc = trim(doc)
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].constructor.name === 'ObjectID') {
              match = match && obj[key].equals(doc[key])
            } else {
              match = match && obj[key] == doc[key]
            }
          })
          return match
        })
        cachedResult = result[0] && new mongoose.models[model](result[0])
      }
      let promise = promiseOrCallback(callback, cb => {
        cb(null, cachedResult)
      })
      promise.populate = populate
      return promise
    }

    mongoose.models[model].findOneAndUpdate = (doc, update, callback) => {
      if (doc.constructor.name === 'ObjectID') {
        cachedResult = db[model].find(obj => obj['_id'].equals(doc))
      } else {
        doc = trim(doc)
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].constructor.name === 'ObjectID') {
              match = match && obj[key].equals(doc[key])
            } else {
              match = match && obj[key] == doc[key]
            }
          })
          return match
        })
        cachedResult = result[0]
      }
      Object.keys(update).forEach(key => {
        cachedResult[key] = update[key]
      })
      cachedResult = new mongoose.models[model](cachedResult)
      return promiseOrCallback(callback, cb => {
        cb(null, cachedResult)
      })
    }

    mongoose.models[model].prototype.save = (callback) => {
      return promiseOrCallback(callback, cb => {
        cb(null, {})
      })
    }

    mongoose.models[model].deleteOne = (doc, callback) => {
      return promiseOrCallback(callback, cb => {
        let result = db[model].find(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].constructor.name === 'ObjectID') {
              match = match && obj[key] == doc[key]
            } else {
              match = match && obj[key] == doc[key]
            }
          })
          return match
        })
        let idx = db[model].indexOf(result[0])
        db[model] = db[model].splice(idx, 1)
        cb(null, result)
      })
    }

    mongoose.models[model].updateOne = (doc, update, callback) => {
      return promiseOrCallback(callback, cb => {
        let result = db[model].find(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].constructor.name === 'ObjectID') {
              match = match && obj[key] == doc[key].toString()
            } else {
              match = match && obj[key] == doc[key]
            }
          })
          return match
        })
        let idx = db[model].indexOf(result)
        Object.keys(update).forEach(key => {
          db[model][idx][key] = update[key]
        })
        cb(null, db[model][idx])
      })
    }

    // mongoose.models[model].findById = (id, callback) => {
    //     return promiseOrCallback(callback, cb => {
    //         let result = db[model].filter(obj => {
    //             return obj["_id"] == id
    //         })
    //         cb(null, result[0])
    //     })
    // }

    mongoose.models[model].update = (doc, update, callback) => {
      return promiseOrCallback(callback, cb => {
        let arr = []
        db[model].forEach((obj, i) => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].constructor.name === 'ObjectID') {
              match = match && obj[key] == doc[key].toString()
            } else {
              match = match && obj[key] == doc[key]
            }
          })
          if (match) {
            const updated = Object.assign({}, obj, update)
            db[model][i] = updated
            arr.push(updated)
          }
        })
        cb(null, arr)
      })
    }

    mongoose.models[model].find = (doc, callback) => {
      return promiseOrCallback(callback, cb => {
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].constructor.name === 'ObjectID') {
              match = match && obj[key] == doc[key].toString()
            } else {
              match = match && obj[key] == doc[key]
            }
          })
          return match
        })
        cb(null, result)
      })
    }
  })

  mongoose.connect = function (url, callback) {
    callback(null)
  }
}
