'use strict'

const Task = use('Task')
const { exec } = require('child_process')
const fs = require('fs')
const moment = require('moment')

async function createfile(){
  try {
      var logs = fs.readFileSync('./public/logs/logs.txt', 'utf8');
      exec('sh public/createfolder.sh', (err, stdout, stderr) => {
        if (!err) {
          return fs.writeFileSync("./public/logs/logs.txt",logs +"\n"+ moment() + ' : successfully generated' +"\n"+ stdout  + "==================================================")
        }else{
          fs.writeFileSync("./public/logs/logs.txt",logs +"\n"+ moment() +" : "+ err.message)
        }
      });
      
  } catch (e) {
      fs.writeFileSync("./public/logs/logs.txt",logs +"\n"+ moment() +" : "+ e.message)
      createfile();
  }
}

class Fivemin extends Task {
  static get schedule () {
    return '1 2,7,12,17,22,27,32,37,42,47,52,57  * * * *'
    // return '* * * * * *'
  }

  async handle () {
    createfile();
  }
}

module.exports = Fivemin
