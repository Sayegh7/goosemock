var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
let db = {};
const PromiseProvider = require('./promise_provider');

const promiseOrCallback = function (callback, fn) {
    if (typeof callback === 'function') {
        try {
            return fn(callback);
        } catch (error) {
            return process.nextTick(() => {
                throw error;
            });
        }
    }

    const Promise = PromiseProvider.get();

    return new Promise((resolve, reject) => {
        fn(function (error, res) {
            if (error != null) {
                return reject(error);
            }
            if (arguments.length > 2) {
                return resolve(Array.prototype.slice.call(arguments, 1));
            }
            resolve(res);
        });
    });
};

module.exports = function () {

    const models = Object.keys(mongoose.models)


    models.forEach(model => {
        db[model] = [];

        mongoose.models[model].insertMany = (arr, options, callback) => {
            return promiseOrCallback(callback, cb => {
                arr.forEach(doc => {
                    db[model].push(doc);
                })
                cb(null, arr)
            });

        }
        mongoose.models[model].create = (doc, callback) => {
            return promiseOrCallback(callback, cb => {
                db[model].push({ ...doc, _id: new ObjectId() });
                cb(null, doc)
            });
        }
        mongoose.models[model].findOne = (doc, callback) => {
            return promiseOrCallback(callback, cb => {
                let result = db[model].filter(obj => {
                    let keys = Object.keys(doc);
                    let match = true;
                    keys.forEach(key => {
                        if (doc[key].constructor.name === 'ObjectID') {
                            match = match && obj[key] == doc[key].toString();
                        } else {
                            match = match && obj[key] == doc[key];
                        }
                    })
                    return match;
                })
                cb(null, result[0]);
            });
        }


        // TODO:
        mongoose.models[model].findById = (id, callback) => {
            return promiseOrCallback(callback, cb => {
                let result = db[model].filter(obj => {
                    return obj["_id"] == id;
                })

                cb(null, result[0]);
            });
        }


        mongoose.models[model].deleteOne = (doc, callback) => {
            return promiseOrCallback(callback, cb => {
                let result = db[model].find(obj => {
                    let keys = Object.keys(doc);
                    let match = true;
                    keys.forEach(key => {
                        if (doc[key].constructor.name === 'ObjectID') {
                            match = match && obj[key] == doc[key].toString();
                        } else {
                            match = match && obj[key] == doc[key];
                        }
                    })
                    return match;
                })
                let idx = db[model].indexOf(result[0]);
                db[model] = db[model].splice(idx, 1);
                cb(null, result[0]);
            });
        }


        mongoose.models[model].updateOne = (doc, callback) => {
            return promiseOrCallback(callback, cb => {
                let result = db[model].find(obj => {
                    let keys = Object.keys(doc);
                    let match = true;
                    keys.forEach(key => {
                        if (doc[key].constructor.name === 'ObjectID') {
                            match = match && obj[key] == doc[key].toString();
                        } else {
                            match = match && obj[key] == doc[key];
                        }
                    })
                    return match;
                })
                let idx = db[model].indexOf(result[0]);
                Object.keys(doc).forEach(key => {
                    db[model][idx][key] = doc[key];
                })
                cb(null, db[model][idx]);
            });
        }


        mongoose.models[model].findById = (id, callback) => {
            return promiseOrCallback(callback, cb => {
                let result = db[model].filter(obj => {
                    return obj["_id"] == id;
                })
                cb(null, result[0]);
            });
        }


        mongoose.models[model].find = (doc, callback) => {
            return promiseOrCallback(callback, cb => {
                let result = db[model].filter(obj => {
                    let keys = Object.keys(doc);
                    let match = true;
                    keys.forEach(key => {
                        if (doc[key].constructor.name === 'ObjectID') {
                            match = match && obj[key] == doc[key].toString();
                        } else {
                            match = match && obj[key] == doc[key];
                        }
                    })
                    return match;
                })
                cb(null, result);
            });
        }
    })

    mongoose.connect = function (url, callback) {
        callback(null);
    };
}