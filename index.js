var mongoose = require('mongoose')
var ObjectId = mongoose.Types.ObjectId
let db = {}
let cachedResult = {}
let cachedResultArr = []
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
        return obj._id.toString() === cachedResult[field].toString()
      })[0]
      cachedResult[field] = new mongoose.models[cachedResult.schema.obj[field].ref](prop)
      cb(null, cachedResult)
    })
  }

  const populateArray = (field, callback) => {
    return promiseOrCallback(callback, cb => {
      if (cachedResultArr.length === 0) {
        cb(null, cachedResult)
        return
      }
      let result = []
      cachedResultArr.forEach(cachedResult => {
        const prop = db[cachedResult.schema.obj[field].ref].filter(obj => {
          return obj._id.toString() === cachedResult[field].toString()
        })[0]
        const res = new mongoose.models[cachedResult.schema.obj[field].ref](prop)
        result.push(res)
      })
      cb(null, result)
    })
  }

  const trim = (doc) => {
    Object.keys(doc).forEach(key => {
      if (doc[key] && doc[key].id && typeof doc[key].id === 'string') { doc[key] = doc[key].id }
    })
    return doc
  }

  models.forEach(model => {
    db[model] = []

    const Model = mongoose.models[model]

    const equals = (lhs, rhs) => {
      if (rhs.constructor.name === 'ObjectID') {
        return lhs == rhs.toString()
      } else {
        return lhs == rhs
      }
    }

    Model.insertMany = (arr, options, callback) => {
      return promiseOrCallback(callback, cb => {
        arr.forEach(doc => {
          db[model].push(doc)
        })
        cb(null, arr)
      })
    }

    Model.create = (doc, callback) => {
      return promiseOrCallback(callback, cb => {
        doc = trim(doc)
        const paths = Model.schema.paths
        Object.keys(paths).forEach(path => {
          if (!doc[path]) {
            if (typeof paths[path].defaultValue === 'function') { doc[path] = paths[path].defaultValue() } else if (typeof paths[path].defaultValue !== 'undefined') { doc[path] = paths[path].defaultValue }
          }
        })
        const obj = { ...doc, _id: new ObjectId() }
        const document = new Model(obj)
        const error = document.validateSync()
        if (!error) {
          db[model].push(obj)
          cb(null, document)
        } else {
          cb(error)
        }
      })
    }

    Model.findOne = (doc, callback) => {
      if (doc.constructor.name === 'ObjectID') {
        let result = db[model].find(obj => obj['_id'].equals(doc))
        cachedResult = result && new Model(result)
      } else {
        doc = trim(doc)
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            match = match && equals(obj[key], doc[key])
          })
          return match
        })
        cachedResult = result[0] && new Model(result[0])
      }
      let promise = promiseOrCallback(callback, cb => {
        cb(null, cachedResult)
      })
      promise.populate = populate
      return promise
    }

    Model.findOneAndUpdate = (doc, update, callback) => {
      if (doc.constructor.name === 'ObjectID') {
        cachedResult = db[model].find(obj => obj['_id'].equals(doc))
      } else {
        doc = trim(doc)
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            match = match && equals(obj[key], doc[key])
          })
          return match
        })
        cachedResult = result[0]
      }
      Object.keys(update).forEach(key => {
        cachedResult[key] = update[key]
      })
      cachedResult = new Model(cachedResult)
      return promiseOrCallback(callback, cb => {
        cb(null, cachedResult)
      })
    }

    Model.prototype.save = (callback) => {
      return promiseOrCallback(callback, cb => {
        cb(null, {})
      })
    }

    Model.deleteMany = (doc, options, callback) => {
      return promiseOrCallback(callback, cb => {
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            match = match && equals(obj[key], doc[key])
          })
          return match
        })
        result.forEach(x => {
          let idx = db[model].indexOf(x)
          db[model] = db[model].splice(idx, 1)
        })
        return cb(null, result)
      })
    }

    Model.deleteOne = (doc, callback) => {
      return promiseOrCallback(callback, cb => {
        let result = db[model].find(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            match = match && equals(obj[key], doc[key])
          })
          return match
        })
        let idx = db[model].indexOf(result)
        if (!result) return cb(null, [])
        db[model] = db[model].splice(idx, 1)
        cb(null, result)
      })
    }

    Model.updateOne = (doc, update, callback) => {
      return promiseOrCallback(callback, cb => {
        let result = db[model].find(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            match = match && equals(obj[key], doc[key])
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

    Model.update = (doc, update, callback) => {
      return promiseOrCallback(callback, cb => {
        let arr = []
        db[model].forEach((obj, i) => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            if (doc[key].$ne) {
              match = match && !equals(obj[key], doc[key].$ne)
            } else {
              match = match && equals(obj[key], doc[key])
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

    Model.find = (doc, callback) => {
      const promise = promiseOrCallback(callback, cb => {
        let result = db[model].filter(obj => {
          let keys = Object.keys(doc)
          let match = true
          keys.forEach(key => {
            match = match && equals(obj[key], doc[key])
          })
          return match
        })
        cachedResultArr = result.map(res => new Model(res))
        cb(null, result)
      })
      promise.populate = populateArray
      return promise
    }
  })

  mongoose.connect = function (url, callback) {
    callback(null)
  }
}
