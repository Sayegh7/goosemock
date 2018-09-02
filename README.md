# Goosemock
[![npm version](https://badge.fury.io/js/goosemock.svg)](https://badge.fury.io/js/goosemock)

Goosemock is mongoose mocking framework. This package was created because we needed to write unit tests on a backend that used mongoose and we needed something to mock the behavior of mongoose but in a dynamic way. It is essentially an in memory database but without the need for a even a database server or any installations. All mongoose functions affect in-memory data data structures.

## Installation
Install Goosemock with npm
```
npm install goosemock
```

## Usage
Using goosemock is simple. Simply require and run it after mongoose like so:
```
const mongoose = require('mongoose');
const goosemock = require('goosemock');

goosemock();
```
Now all calls to mongoose functions will be executed in-memory. Note also that even `mongoose.connect()` will no longer be able to connect to the server as it is intercepted by goosemock.