import bluebird from 'bluebird'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'

global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });


async function app() {
  let ids = await knex('users').returning('id').insert({
    username:   "test123213",
    screenname: "33",
    email:      "text1234",
    pw_hash:    ""
  })

  console.log(ids)

  let res = await knex.select('id').from('users')
  console.log(res)
  await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})



