import bluebird from 'bluebird'
import {default as faker} from 'faker'
import _ from 'lodash'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'


global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });

//let timing = {}

async function app() {
  const usersCount  = 1000
  const groupsCount = 100
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


  console.time('subscribe_user_to_groups')
  promises = usersRange.map((id)=>{
    return subscribeUserToRandomGroups(id, groupIds)
  })
  const subscribedGroupsCount = await Promise.all(promises)
  console.timeEnd('subscribe_user_to_groups')
  const averageGroupsSubscribed = _.reduce(subscribedGroupsCount, (res, val) => {
    return res + val
  }, 0) / subscribedGroupsCount.length


  console.time('subscribe_user_to_users')
  promises = usersRange.map((id)=>{
    return subscribeUserToRandomUsers(id, _.without(usersRange, id))
  })
  const subscribedUsersCount = await Promise.all(promises)
  console.timeEnd('subscribe_user_to_users')
  const averageUsersSubscribed = _.reduce(subscribedUsersCount, (res, val) => {
      return res + val
    }, 0) / subscribedUsersCount.length


  console.time('create_posts')
  promises = usersRange.map((i)=>{
    const isPublic = !isFeedPrivate(i)
    let payload = {
      is_public: isPublic,
      feed_ids: [i]
    }
    return createPost(payload)
  })
  await Promise.all(promises)
  console.timeEnd('create_posts')



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

  console.log(`User average subscribed to ${averageGroupsSubscribed} groups`)
  console.log(`User average subscribed to ${averageUsersSubscribed} users`)

  count = await countEntries('posts')
  console.log(`Posts created: ${count}`)

  await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})


async function createUser(){
  return knex('users').returning('id').insert({})
}

async function subscribeUserToRandomGroups(userId, groupIds){
  const subscrCount = _.random(0, 20)
  const subscribedGroups = _.sample(groupIds, subscrCount)

  await addValuesToIntarrayField('users', userId, 'subscr_feed_ids', subscribedGroups)
  return subscrCount
}

async function subscribeUserToOwnFeeds(userId){
  let feedsIds = getUserFeedsIds(userId)

  let ownFeed = await findFeed(feedsIds.own)
  if (!ownFeed.is_public){
    await addValuesToIntarrayField('users', userId, 'private_feed_ids', [feedsIds.own])
  }
  return addValuesToIntarrayField('users', userId, 'subscr_feed_ids', [feedsIds.own, feedsIds.comments, feedsIds.likes])
}

async function subscribeUserToRandomUsers(userId, userIds){
  const subscrCount = _.random(5, 500)
  const subscribedUsers = _.sample(userIds, subscrCount)
  let feedIds = subscribedUsers.map((id) => {
    return getUserFeedsIds(id)
  }).reduce((res, val) => {
    res.push(val.own)
    res.push(val.comments)
    res.push(val.likes)
    return res
  }, [])

  await addValuesToIntarrayField('users', userId, 'subscr_feed_ids', feedIds)
  return subscrCount
}

async function createFeed(payload){
  return knex('feeds').returning('id').insert(payload)
}

async function findFeed(id){
  let res = await knex('feeds').where({id: id})
  return res[0]
}

function isFeedBase(feedId){
  return feedId >= 1 && feedId <= 1000
}

function isFeedPrivate(feedId){
  return feedId % 10 == 0
}

function isFeedBaseAndPrivate(feedId){
  return isFeedBase(feedId) && isFeedPrivate(feedId)
}

async function createPost(payload){
  return knex('posts').returning('id').insert(payload)
}
async function _createPost(userId, groupIds){
  const postCount = _.random(0, 5000)

  _.range(0, postCount).map((i)=>{
    let feedId = userId
    const rand = Math.random()
    if (rand >= 0.8){
      feedId = _.sample(groupIds)
    }
    return feedId
  }).map((feedId) => {
    const isPublic = isFeedBaseAndPrivate(feedId)
    return {
      is_public: isPublic,
      feed_ids: [feedId]
    }
  })

  const subscribedGroups = _.sample(groupIds, postCount)

  await addValuesToIntarrayField('users', userId, 'subscr_feed_ids', subscribedGroups)
  return postCount

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

function getUserFeedsIds(userId){
  return {
    own:      userId,
    comments: 11000 + userId,
    likes:    21000 + userId
  }
}


