import bluebird from 'bluebird'
import {default as faker} from 'faker'
import _ from 'lodash'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'


global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });

//let timing = {}

async function app() {
  const usersCount  = 10
  const groupsCount = 0
  const usersRange = _.range(1, usersCount + 1)

  let promises


  console.time('create_users')
  promises = usersRange.map((i)=>{
    return createUser()
  })
  await Promise.all(promises)
  console.timeEnd('create_users')


  console.time('create_base_feeds')
  promises = usersRange.map((i)=>{
    const isPublic = (i % 10) !== 0
    const payload = {type: 'base', is_public: isPublic}
    return createFeed(payload)
  })
  await Promise.all(promises)
  console.timeEnd('create_base_feeds')


  console.time('create_group_feeds')
  promises = [...Array(groupsCount).keys()].map((i)=>{
    return createFeed({type: 'group'})
  })
  const groupIds = await Promise.all(promises)
  console.timeEnd('create_group_feeds')


  console.time('create_comment_feeds')
  promises = usersRange.map((i)=>{
    return createFeed({type: 'comments'})
  })
  await Promise.all(promises)
  console.timeEnd('create_comment_feeds')


  console.time('create_like_feeds')
  promises = usersRange.map((i)=>{
    return createFeed({type: 'likes'})
  })
  await Promise.all(promises)
  console.timeEnd('create_like_feeds')


  console.time('subscribe_user_to_own_feeds')
  promises = usersRange.map((i)=>{
    return subscribeUserToOwnFeeds(i)
  })
  await Promise.all(promises)
  console.timeEnd('subscribe_user_to_own_feeds')




  /*console.time('create_posts')
  promises = [...Array(usersCount).keys()].map((i)=>{


    return createUser()
  })
  await Promise.all(promises)
  console.timeEnd('create_users')*/



  let count
  count = await countEntries('users')
  console.log(`Users created: ${count}`)

  count = await countEntries('feeds', {type: 'base'})
  console.log(`Base feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'base', is_public: false})
  console.log(`Private base feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'group'})
  console.log(`Groups created: ${count}`)

  count = await countEntries('feeds', {type: 'comments'})
  console.log(`Comments feeds created: ${count}`)

  count = await countEntries('feeds', {type: 'likes'})
  console.log(`Likes feeds created: ${count}`)

  await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})


async function createUser(){
  return await knex('users').returning('id').insert({})
}

async function subscribeUserToOwnFeeds(userId){
  let ownFeedId       = userId
  let commentsFeedId  = 11000 + userId
  let likesFeedId     = 21000 + userId

  let ownFeed = (await knex('feeds').where({id: ownFeedId}))[0]
  if (!ownFeed.is_public){
    await addValuesToIntarrayField('users', userId, 'private_feed_ids', [ownFeedId])
  }
  return addValuesToIntarrayField('users', userId, 'subscr_feed_ids', [ownFeedId, commentsFeedId, likesFeedId])
}

async function createFeed(payload){
  return await knex('feeds').returning('id').insert(payload)
}

async function countEntries(tableName, query = {}){
  const res = await knex(tableName).where(query).count()
  return res[0].count
}

function addValuesToIntarrayField(tableName, entryId, fieldName, values){
  if (!_.isArray(values)){
    throw new Error("values should be array")
  }
  return knex.raw(`UPDATE ${tableName} SET ${fieldName} = uniq(${fieldName} + ?) WHERE id = ?`, [values, entryId])
}


