import bluebird from 'bluebird'
import {default as faker} from 'faker'
import _ from 'lodash'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'


global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });

const USERS_COUNT = 10000
const GROUPS_COUNT = 1000
const POSTS_PER_USER_MIN = 0
const POSTS_PER_USER_MAX = 5000
const POSTS_CREATION_CHUNK = 500
const FRIENDS_PER_USER_MIN = 5
const FRIENDS_PER_USER_MAX = 500
const GROUPS_PER_USER_MIN = 0
const GROUPS_PER_USER_MAX = 20
const POST_LIKES_MIN = 0
const POST_LIKES_MAX = 50
const POST_LIKES_CHUNK = 1000
const POST_COMMENTS_MIN = 0
const POST_COMMENTS_MAX = 50
let globalLikesCount = 0
let globalCommentsCount = 0
const userIdsRange  = _.range(1, USERS_COUNT + 1)
const groupIdsRange = _.range(1, GROUPS_COUNT + 1)

async function app() {
  let promises


  console.time('create_users')
  promises = userIdsRange.map((id)=>{
    return createUser()
  })
  await Promise.all(promises)
  console.timeEnd('create_users')


  console.time('create_base_feeds')
  promises = userIdsRange.map((id)=>{
    const isPublic = (id % 10) !== 0
    const payload = {type: 'base', is_public: isPublic}
    return createFeed(payload)
  })
  await Promise.all(promises)
  console.timeEnd('create_base_feeds')


  console.time('create_group_feeds')
  promises = groupIdsRange.map((id)=>{
    return createFeed({type: 'group'})
  })
  const groupIds = await Promise.all(promises)
  console.timeEnd('create_group_feeds')


  console.time('create_comment_feeds')
  promises = userIdsRange.map((id)=>{
    return createFeed({type: 'comments'})
  })
  await Promise.all(promises)
  console.timeEnd('create_comment_feeds')


  console.time('create_like_feeds')
  promises = userIdsRange.map((id)=>{
    return createFeed({type: 'likes'})
  })
  await Promise.all(promises)
  console.timeEnd('create_like_feeds')


  console.time('subscribe_user_to_own_feeds')
  promises = userIdsRange.map((id)=>{
    return subscribeUserToOwnFeeds(id)
  })
  await Promise.all(promises)
  console.timeEnd('subscribe_user_to_own_feeds')


  console.time('subscribe_user_to_groups')
  promises = userIdsRange.map((id)=>{
    return subscribeUserToRandomGroups(id, groupIds)
  })
  const subscribedGroupsCount = await Promise.all(promises)
  console.timeEnd('subscribe_user_to_groups')
  const averageGroupsSubscribed = _.reduce(subscribedGroupsCount, (res, val) => {
    return res + val
  }, 0) / subscribedGroupsCount.length


  console.time('subscribe_user_to_users')
  promises = userIdsRange.map((id)=>{
    return subscribeUserToRandomUsers(id, _.without(userIdsRange, id))
  })
  const subscribedUsersCount = await Promise.all(promises)
  console.timeEnd('subscribe_user_to_users')
  const averageUsersSubscribed = _.reduce(subscribedUsersCount, (res, val) => {
      return res + val
    }, 0) / subscribedUsersCount.length


  console.time('create_posts')
  promises = userIdsRange.map((id)=>{
    return createUserPosts(id)
  })
  const postsPerUserCount = await Promise.all(promises)
  console.timeEnd('create_posts')
  const averagePostsCount = _.reduce(postsPerUserCount, (res, val) => {
    return res + val
  }, 0) / postsPerUserCount.length


  let postsCount = await countEntries('posts')
  const averageLikesPerPost = globalLikesCount / postsCount
  const averageCommentsPerPost = globalCommentsCount / postsCount



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

  console.log(`Posts created: ${postsCount}`)

  console.log(`User average created ${averagePostsCount} posts`)

  console.log(`Post have average ${averageLikesPerPost} likes`)

  console.log(`Post have average ${averageCommentsPerPost} likes`)

  await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})


async function createUser(){
  return knex('users').returning('id').insert({})
}

async function findUser(id){
  let res = await knex('users').where({id: id})
  return res[0]
}

async function subscribeUserToRandomGroups(userId, groupIds){
  const subscrCount = _.random(GROUPS_PER_USER_MIN, GROUPS_PER_USER_MAX)
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
  const subscrCount = _.random(FRIENDS_PER_USER_MIN, FRIENDS_PER_USER_MAX)
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

async function getFeedSubscribersIds(feedId){
  let res = await knex.raw(`SELECT id FROM users WHERE users.subscr_feed_ids @> '{${feedId}}'`)
  return res.rows.map((r)=>{return r.id})
}

async function likePost(userId, postId){
  const likesFeedId = getUserLikesFeedId(userId)
  return addValuesToIntarrayField('posts', postId, 'feed_ids', [likesFeedId])
}

async function commentPost(userId, postId){
  const commentsFeedId = getUserCommentsFeedId(userId)
  return addValuesToIntarrayField('posts', postId, 'feed_ids', [commentsFeedId])
}


async function createFeed(payload){
  return knex('feeds').returning('id').insert(payload)
}

async function findFeed(id){
  let res = await knex('feeds').where({id: id})
  return res[0]
}

function isFeedBase(feedId){
  return feedId >= 1 && feedId <= USERS_COUNT
}

function isFeedPrivate(feedId){
  return feedId % 10 == 0
}

function isFeedBaseAndPrivate(feedId){
  return isFeedBase(feedId) && isFeedPrivate(feedId)
}

async function createPost(payload){
  return knex('posts').insert(payload)
}

async function findPost(id){
  let res = await knex('posts').where({id: id})
  return res[0]
}

async function createUserPosts(userId){
  const postCount = _.random(POSTS_PER_USER_MIN, POSTS_PER_USER_MAX)
  const chunkSize = POSTS_CREATION_CHUNK

  let payloads
  for (let i = 0; i < postCount; i += chunkSize) {
    process.stdout.write('.')
    payloads = []
    for (let j = 0; j < chunkSize; j += 1) {
      payloads.push(createPostPayload(userId))
    }
    await createPost(payloads)
  }

  return postCount
}

function createPostPayload(userId){
  let feedId = userId
  const rand = Math.random()

  if (rand >= 0.8){
    feedId = _.sample(groupIdsRange)[0]
  }

  const isPublic = isFeedBaseAndPrivate(feedId)
  let feedIds = [feedId]

  let likesCount = _.random(POST_LIKES_MIN, POST_LIKES_MAX)
  let commentsCount = _.random(POST_COMMENTS_MIN, POST_COMMENTS_MAX)
  globalLikesCount += likesCount
  globalCommentsCount += commentsCount
  let likedUserIds = _.sample(userIdsRange, likesCount)
  let commentedUserIds = _.sample(userIdsRange, commentsCount)
  let likesFeedIds = likedUserIds.map((userId)=>{ return getUserLikesFeedId(userId)})
  let commentsFeedIds = commentedUserIds.map((userId)=>{ return getUserCommentsFeedId(userId)})
  feedIds = _.union(feedIds, likesFeedIds)
  feedIds = _.union(feedIds, commentsFeedIds)

  return {
    is_public: isPublic,
    feed_ids: feedIds
  }
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
    comments: getUserCommentsFeedId(userId),
    likes:    getUserLikesFeedId(userId)
  }
}

function getUserLikesFeedId(userId){
  return USERS_COUNT + GROUPS_COUNT + USERS_COUNT + userId
}

function getUserCommentsFeedId(userId){
  return USERS_COUNT + GROUPS_COUNT + userId
}

